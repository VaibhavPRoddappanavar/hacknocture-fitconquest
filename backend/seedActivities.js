/**
 * seedActivities.js
 * ------------------
 * Seeds 20 Bengaluru users + 30 activities with a REALISTIC MIX of:
 *   • LOOP routes (Polygon)   — parks, lake circuits → shown as filled regions
 *   • STRAIGHT routes (LineString) — commutes, A→B paths → shown as lines
 *
 * Run: node seedActivities.js
 */

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const User = require("./models/User");
const Activity = require("./models/Activity");

// ─── Bengaluru anchors ─────────────────────────────────────────────────────
const PLACES = {
  cubbon_park:      { lat: 12.9763, lng: 77.5929 },
  lalbagh:          { lat: 12.9507, lng: 77.5848 },
  ulsoor_lake:      { lat: 12.9830, lng: 77.6185 },
  indiranagar:      { lat: 12.9784, lng: 77.6408 },
  koramangala:      { lat: 12.9352, lng: 77.6245 },
  jayanagar:        { lat: 12.9308, lng: 77.5838 },
  whitefield:       { lat: 12.9698, lng: 77.7500 },
  electronic_city:  { lat: 12.8452, lng: 77.6602 },
  hebbal:           { lat: 13.0358, lng: 77.5970 },
  bannerghatta:     { lat: 12.8002, lng: 77.5769 },
  mg_road:          { lat: 12.9756, lng: 77.6070 },
  hsr_layout:       { lat: 12.9116, lng: 77.6389 },
  marathahalli:     { lat: 12.9591, lng: 77.6971 },
  jp_nagar:         { lat: 12.9063, lng: 77.5857 },
  malleshwaram:     { lat: 13.0035, lng: 77.5643 },
};

// ─── LOOP route generator (Polygon) ────────────────────────────────────────
// Generates an irregular polygon (closed loop) around an anchor
function generateLoop(anchor, radiusKm = 0.5, numVertices = 8) {
  const degPerKm = 1 / 111;
  const radiusDeg = radiusKm * degPerKm;
  const angleStep = (2 * Math.PI) / numVertices;
  const ring = [];

  for (let i = 0; i < numVertices; i++) {
    const angle = angleStep * i + (Math.random() - 0.5) * angleStep * 0.35;
    const r = radiusDeg * (0.6 + Math.random() * 0.5);
    const lat = anchor.lat + r * Math.sin(angle);
    const lng = anchor.lng + r * Math.cos(angle) / Math.cos(anchor.lat * Math.PI / 180);
    ring.push([parseFloat(lng.toFixed(6)), parseFloat(lat.toFixed(6))]);
  }
  ring.push(ring[0]); // close the ring
  return ring;
}

// ─── STRAIGHT route generator (LineString) ─────────────────────────────────
// Generates a realistic A→B path with some natural wandering
function generateStraightRoute(from, to, numPoints = 8) {
  const coords = [];
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    // Interpolate with some random perpendicular offset
    const lat = from.lat + (to.lat - from.lat) * t + (Math.random() - 0.5) * 0.003;
    const lng = from.lng + (to.lng - from.lng) * t + (Math.random() - 0.5) * 0.003;
    coords.push([parseFloat(lng.toFixed(6)), parseFloat(lat.toFixed(6))]);
  }
  return coords;
}

// ─── Area calculation for loops (Shoelace formula) ─────────────────────────
function calculateAreaSqM(ring) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371000;
  const centerLat = ring.reduce((s, p) => s + p[1], 0) / (ring.length - 1);
  const mPerDegLat = (Math.PI * R) / 180;
  const mPerDegLng = mPerDegLat * Math.cos(toRad(centerLat));

  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const x1 = ring[i][0] * mPerDegLng, y1 = ring[i][1] * mPerDegLat;
    const j = (i + 1) % (ring.length - 1);
    const x2 = ring[j][0] * mPerDegLng, y2 = ring[j][1] * mPerDegLat;
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area / 2);
}

// ─── Time builder ──────────────────────────────────────────────────────────
function buildStartTime(daysAgo, hour, min = 0) {
  const now = new Date("2026-03-13T17:30:00+05:30");
  const d = new Date(now);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, min, 0, 0);
  return d;
}

// ─── Activity templates ────────────────────────────────────────────────────
// shape: "loop" → Polygon | "straight" → LineString
// For straight, we specify `from` and `to` place names
const TEMPLATES = [
  // ── Day 2 ago (March 11) ─────────────────────────────────────
  // LOOPS — park walks and cycling circuits
  { shape: "loop",     type: "walk",  place: "cubbon_park",    daysAgo: 2, hour: 6,  min: 0,   distM: 5200,  durS: 3120,  src: "app",          radius: 0.45, verts: 10 },
  { shape: "loop",     type: "walk",  place: "cubbon_park",    daysAgo: 2, hour: 6,  min: 15,  distM: 3100,  durS: 2400,  src: "googleFit",    radius: 0.35, verts: 8  },  // overlaps
  { shape: "loop",     type: "cycle", place: "lalbagh",        daysAgo: 2, hour: 7,  min: 0,   distM: 12000, durS: 2400,  src: "strava",       radius: 1.2,  verts: 12 },
  { shape: "loop",     type: "walk",  place: "ulsoor_lake",    daysAgo: 2, hour: 7,  min: 0,   distM: 2800,  durS: 2100,  src: "app",          radius: 0.3,  verts: 8  },
  // STRAIGHT — commutes and A→B walks
  { shape: "straight", type: "walk",  from: "indiranagar",     to: "mg_road",         daysAgo: 2, hour: 8,  min: 0,   distM: 4200,  durS: 2520,  src: "app",          pts: 10 },
  { shape: "straight", type: "cycle", from: "koramangala",     to: "electronic_city", daysAgo: 2, hour: 7,  min: 30,  distM: 14000, durS: 2520,  src: "strava",       pts: 14 },
  { shape: "loop",     type: "walk",  place: "jayanagar",      daysAgo: 2, hour: 5,  min: 45,  distM: 5500,  durS: 3300,  src: "app",          radius: 0.4,  verts: 8  },
  { shape: "straight", type: "walk",  from: "koramangala",     to: "jayanagar",       daysAgo: 2, hour: 6,  min: 10,  distM: 3500,  durS: 2100,  src: "googleFit",    pts: 8  },
  { shape: "loop",     type: "cycle", from: "bannerghatta",    place: "bannerghatta", daysAgo: 2, hour: 7,  min: 30,  distM: 22000, durS: 4200,  src: "strava",       radius: 2.0, verts: 14 },
  { shape: "straight", type: "walk",  from: "malleshwaram",    to: "hebbal",          daysAgo: 2, hour: 6,  min: 30,  distM: 4800,  durS: 2880,  src: "appleFitness", pts: 10 },

  // ── Yesterday (March 12) ─────────────────────────────────────
  { shape: "loop",     type: "walk",  place: "cubbon_park",    daysAgo: 1, hour: 6,  min: 0,   distM: 5400,  durS: 3240,  src: "app",          radius: 0.42, verts: 10 },  // overlap cubbon
  { shape: "loop",     type: "cycle", place: "cubbon_park",    daysAgo: 1, hour: 6,  min: 20,  distM: 10500, durS: 2100,  src: "strava",       radius: 1.0,  verts: 12 },  // big cycle over cubbon
  { shape: "loop",     type: "walk",  place: "hebbal",         daysAgo: 1, hour: 6,  min: 0,   distM: 8200,  durS: 4920,  src: "app",          radius: 0.55, verts: 10 },
  { shape: "straight", type: "walk",  from: "hebbal",          to: "malleshwaram",    daysAgo: 1, hour: 6,  min: 30,  distM: 3400,  durS: 2040,  src: "appleFitness", pts: 8  },  // overlaps hebbal area
  { shape: "straight", type: "cycle", from: "indiranagar",     to: "whitefield",      daysAgo: 1, hour: 7,  min: 0,   distM: 15000, durS: 2700,  src: "strava",       pts: 16 },
  { shape: "straight", type: "walk",  from: "electronic_city", to: "jp_nagar",        daysAgo: 1, hour: 5,  min: 30,  distM: 10100, durS: 6060,  src: "app",          pts: 14 },
  { shape: "loop",     type: "walk",  place: "lalbagh",        daysAgo: 1, hour: 8,  min: 0,   distM: 2600,  durS: 1560,  src: "googleFit",    radius: 0.3,  verts: 8  },
  { shape: "loop",     type: "walk",  place: "ulsoor_lake",    daysAgo: 1, hour: 6,  min: 45,  distM: 4900,  durS: 2940,  src: "app",          radius: 0.38, verts: 8  },
  { shape: "straight", type: "cycle", from: "marathahalli",    to: "whitefield",      daysAgo: 1, hour: 8,  min: 30,  distM: 8000,  durS: 1440,  src: "strava",       pts: 10 },
  { shape: "loop",     type: "walk",  place: "jayanagar",      daysAgo: 1, hour: 6,  min: 0,   distM: 5800,  durS: 3480,  src: "app",          radius: 0.42, verts: 9  },

  // ── Today (March 13) ─────────────────────────────────────────
  { shape: "loop",     type: "walk",  place: "cubbon_park",    daysAgo: 0, hour: 6,  min: 0,   distM: 5100,  durS: 3060,  src: "app",          radius: 0.4,  verts: 10 },  // overlap cubbon 3rd day
  { shape: "loop",     type: "walk",  place: "lalbagh",        daysAgo: 0, hour: 7,  min: 0,   distM: 2900,  durS: 1740,  src: "googleFit",    radius: 0.32, verts: 8  },
  { shape: "loop",     type: "cycle", place: "koramangala",    daysAgo: 0, hour: 7,  min: 30,  distM: 13000, durS: 2700,  src: "strava",       radius: 1.3,  verts: 12 },
  { shape: "straight", type: "walk",  from: "indiranagar",     to: "ulsoor_lake",     daysAgo: 0, hour: 6,  min: 15,  distM: 3200,  durS: 1920,  src: "app",          pts: 8  },
  { shape: "straight", type: "walk",  from: "indiranagar",     to: "koramangala",     daysAgo: 0, hour: 6,  min: 30,  distM: 5500,  durS: 3300,  src: "appleFitness", pts: 10 },  // overlaps indiranagar
  { shape: "loop",     type: "cycle", place: "hebbal",         daysAgo: 0, hour: 8,  min: 0,   distM: 16000, durS: 3000,  src: "strava",       radius: 1.5,  verts: 12 },
  { shape: "straight", type: "walk",  from: "electronic_city", to: "hsr_layout",      daysAgo: 0, hour: 5,  min: 45,  distM: 9600,  durS: 5760,  src: "app",          pts: 12 },
  { shape: "loop",     type: "walk",  place: "bannerghatta",   daysAgo: 0, hour: 7,  min: 0,   distM: 4100,  durS: 2460,  src: "googleFit",    radius: 0.38, verts: 8  },
  { shape: "straight", type: "cycle", from: "mg_road",         to: "whitefield",      daysAgo: 0, hour: 9,  min: 0,   distM: 21000, durS: 3780,  src: "strava",       pts: 18 },
  { shape: "loop",     type: "walk",  place: "ulsoor_lake",    daysAgo: 0, hour: 6,  min: 30,  distM: 4700,  durS: 2820,  src: "app",          radius: 0.35, verts: 8  },
];

// ─── 20 Bengaluru users ──────────────────────────────────────────────────────
const USERS = [
  "aditya_blr", "bhavna_blr", "chetan_blr", "deepa_blr",
  "esha_blr",   "farhan_blr", "gayatri_blr","harish_blr",
  "ishaan_blr", "jaya_blr",   "karthik_blr","lakshmi_blr",
  "manoj_blr",  "nandini_blr","omkar_blr",  "preethi_blr",
  "quincy_blr", "rohini_blr", "sanjay_blr", "tejaswi_blr"
];

// ─── Main ──────────────────────────────────────────────────────────────────
const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected");

    const passwordHash = await bcrypt.hash("password123", 10);
    const userDocs = [];

    for (const username of USERS) {
      let u = await User.findOne({ username });
      if (!u) {
        u = await User.create({
          username,
          password: passwordHash,
          location: { city: "Bengaluru", state: "Karnataka", country: "India" },
        });
        console.log(`  👤 Created user: ${username}`);
      } else {
        console.log(`  ♻️  Found existing user: ${username}`);
      }
      userDocs.push(u);
    }

    const userIds = userDocs.map((u) => u._id);
    const deleted = await Activity.deleteMany({ userId: { $in: userIds } });
    console.log(`\n🗑️  Cleared ${deleted.deletedCount} old activities`);

    const activities = [];
    let loopCount = 0, straightCount = 0;

    TEMPLATES.forEach((tmpl, idx) => {
      const user = userDocs[idx % userDocs.length];
      const startTime = buildStartTime(tmpl.daysAgo, tmpl.hour, tmpl.min);
      const endTime = new Date(startTime.getTime() + tmpl.durS * 1000);
      const avgSpeed = parseFloat(((tmpl.distM / tmpl.durS) * 3.6).toFixed(2));

      let route, areaSqM = 0;

      if (tmpl.shape === "loop") {
        // Generate a polygon loop around the place
        const anchor = PLACES[tmpl.place];
        const ring = generateLoop(anchor, tmpl.radius, tmpl.verts);
        areaSqM = calculateAreaSqM(ring);
        route = { type: "Polygon", coordinates: [ring] };
        loopCount++;
      } else {
        // Generate a linestring from A to B
        const fromPlace = PLACES[tmpl.from];
        const toPlace = PLACES[tmpl.to];
        const coords = generateStraightRoute(fromPlace, toPlace, tmpl.pts);
        route = { type: "LineString", coordinates: coords };
        straightCount++;
      }

      activities.push({
        userId: user._id,
        activityType: tmpl.type,
        source: tmpl.src,
        distanceMeters: tmpl.distM,
        durationSeconds: tmpl.durS,
        avgSpeed,
        startTime,
        endTime,
        areaSquareMeters: Math.round(areaSqM),
        route,
      });
    });

    await Activity.insertMany(activities);

    console.log(`\n✅ Seeded ${activities.length} activities across 3 days`);
    console.log(`   🔵 ${loopCount} LOOP routes (Polygon regions — parks, circuits)`);
    console.log(`   🟢 ${straightCount} STRAIGHT routes (LineString — A→B commutes)\n`);

    // Summary by day
    console.log("📊 By day:");
    [0, 1, 2].forEach((d) => {
      const label = d === 0 ? "Today" : d === 1 ? "Yesterday" : "2 days ago";
      const dayActs = TEMPLATES.filter((t) => t.daysAgo === d);
      const loops = dayActs.filter((t) => t.shape === "loop").length;
      const straights = dayActs.filter((t) => t.shape === "straight").length;
      console.log(`   ${label}: ${loops} loops + ${straights} paths = ${dayActs.length}`);
    });

    console.log("\n📐 Loop area stats:");
    activities.filter((a) => a.route.type === "Polygon").forEach((a, i) => {
      const tmpl = TEMPLATES.find((_, j) => j === TEMPLATES.indexOf(TEMPLATES.filter(t => t.shape === "loop")[i]));
      const areaKm2 = (a.areaSquareMeters / 1_000_000).toFixed(3);
      console.log(`   ${a.activityType.padEnd(6)} → ${areaKm2} km²`);
    });

    console.log("\n🗺️  Route examples:");
    console.log("   LOOP: Cubbon Park walk, Lalbagh cycle, Ulsoor Lake walk");
    console.log("   LINE: Indiranagar→MG Road, Koramangala→E-City, Hebbal→Malleshwaram\n");

    process.exit(0);
  } catch (err) {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  }
};

seed();
