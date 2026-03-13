/**
 * seedActivities.js
 * ------------------
 * Seeds 20 Bengaluru-based users + ~60 activities (mix of run/walk/cycle)
 * spread across today, yesterday, and 2 days ago.
 * Many routes intentionally overlap so the frontend can handle grouping/deduplication later.
 *
 * Run: node seedActivities.js
 */

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const User = require("./models/User");
const Activity = require("./models/Activity");

// ─── Bengaluru well-known lat/lng anchors ───────────────────────────────────
// Popular running / cycling corridors in Bengaluru
const CORRIDORS = {
  cubbon_park: { lat: 12.9763, lng: 77.5929 },       // Cubbon Park loop
  lalbagh:     { lat: 12.9507, lng: 77.5848 },       // Lalbagh Botanical Garden
  ulsoor_lake: { lat: 12.9830, lng: 77.6185 },       // Ulsoor Lake
  indiranagar: { lat: 12.9784, lng: 77.6408 },       // 100 Feet Rd, Indiranagar
  koramangala:  { lat: 12.9352, lng: 77.6245 },      // Koramangala inner ring
  jayanagar:   { lat: 12.9308, lng: 77.5838 },       // Jayanagar 4th Block Park
  whitefield:  { lat: 12.9698, lng: 77.7500 },       // Whitefield IT corridor
  electronic_city: { lat: 12.8452, lng: 77.6602 },  // Electronic City stretch
  hebbal:      { lat: 13.0358, lng: 77.5970 },       // Hebbal Lake loop
  bannerghatta: { lat: 12.8002, lng: 77.5769 },      // Bannerghatta Road
};

// ─── Helper: generate a LineString route near an anchor ─────────────────────
function generateRoute(anchor, numPoints = 8, spreadKm = 0.8) {
  const degPerKm = 1 / 111; // rough degrees per km
  const spread = spreadKm * degPerKm;
  const coords = [];

  // Start near anchor with small random offset
  let lat = anchor.lat + (Math.random() - 0.5) * spread * 0.5;
  let lng = anchor.lng + (Math.random() - 0.5) * spread * 0.5;

  for (let i = 0; i < numPoints; i++) {
    lat += (Math.random() - 0.5) * spread * 0.3;
    lng += (Math.random() - 0.5) * spread * 0.3;
    // GeoJSON: [lng, lat]
    coords.push([parseFloat(lng.toFixed(6)), parseFloat(lat.toFixed(6))]);
  }
  return coords;
}

// ─── Helper: build a startTime in the past ──────────────────────────────────
// daysAgo: 0 = today, 1 = yesterday, 2 = day before
// hour: hour of day (IST)
function buildStartTime(daysAgo, hour, minuteOffset = 0) {
  const now = new Date("2026-03-13T15:22:35+05:30");
  const d = new Date(now);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minuteOffset, 0, 0);
  return d;
}

// ─── Activity templates ──────────────────────────────────────────────────────
// Each template: { type, corridor, durationSec, distanceM, hour, source }
const ACTIVITY_TEMPLATES = [
  // ── Day 2 ago (March 11) ──────────────────────────────────────
  { type: "run",   corridor: "cubbon_park",     daysAgo: 2, hour: 6,  min: 0,  distM: 5200,  durS: 1680, src: "app" },
  { type: "walk",  corridor: "cubbon_park",     daysAgo: 2, hour: 6,  min: 15, distM: 3100,  durS: 2400, src: "googleFit" },  // overlaps cubbon_park
  { type: "cycle", corridor: "lalbagh",         daysAgo: 2, hour: 7,  min: 0,  distM: 12000, durS: 2400, src: "strava" },
  { type: "run",   corridor: "indiranagar",     daysAgo: 2, hour: 6,  min: 30, distM: 7800,  durS: 2400, src: "app" },
  { type: "walk",  corridor: "ulsoor_lake",     daysAgo: 2, hour: 7,  min: 0,  distM: 2800,  durS: 2100, src: "app" },
  { type: "cycle", corridor: "whitefield",      daysAgo: 2, hour: 8,  min: 0,  distM: 18000, durS: 3600, src: "strava" },
  { type: "run",   corridor: "koramangala",     daysAgo: 2, hour: 6,  min: 0,  distM: 6100,  durS: 1980, src: "app" },
  { type: "walk",  corridor: "koramangala",     daysAgo: 2, hour: 6,  min: 10, distM: 3000,  durS: 2200, src: "googleFit" },  // overlaps koramangala
  { type: "run",   corridor: "jayanagar",       daysAgo: 2, hour: 5,  min: 45, distM: 5500,  durS: 1800, src: "app" },
  { type: "cycle", corridor: "bannerghatta",    daysAgo: 2, hour: 7,  min: 30, distM: 22000, durS: 4200, src: "strava" },

  // ── Yesterday (March 12) ─────────────────────────────────────
  { type: "run",   corridor: "cubbon_park",     daysAgo: 1, hour: 6,  min: 0,  distM: 5400,  durS: 1740, src: "app" },       // overlaps cubbon_park again
  { type: "cycle", corridor: "cubbon_park",     daysAgo: 1, hour: 6,  min: 20, distM: 10500, durS: 2100, src: "strava" },    // triple overlap cubbon
  { type: "run",   corridor: "hebbal",          daysAgo: 1, hour: 6,  min: 0,  distM: 8200,  durS: 2580, src: "app" },
  { type: "walk",  corridor: "hebbal",          daysAgo: 1, hour: 6,  min: 30, distM: 3400,  durS: 2700, src: "appleFitness" }, // overlaps hebbal
  { type: "cycle", corridor: "indiranagar",     daysAgo: 1, hour: 7,  min: 0,  distM: 15000, durS: 2700, src: "strava" },
  { type: "run",   corridor: "electronic_city", daysAgo: 1, hour: 5,  min: 30, distM: 10100, durS: 3300, src: "app" },
  { type: "walk",  corridor: "lalbagh",         daysAgo: 1, hour: 8,  min: 0,  distM: 2600,  durS: 1980, src: "googleFit" },
  { type: "run",   corridor: "ulsoor_lake",     daysAgo: 1, hour: 6,  min: 45, distM: 4900,  durS: 1620, src: "app" },
  { type: "cycle", corridor: "whitefield",      daysAgo: 1, hour: 8,  min: 30, distM: 20000, durS: 3900, src: "strava" },
  { type: "run",   corridor: "jayanagar",       daysAgo: 1, hour: 6,  min: 0,  distM: 5800,  durS: 1860, src: "app" },

  // ── Today (March 13) ─────────────────────────────────────────
  { type: "run",   corridor: "cubbon_park",     daysAgo: 0, hour: 6,  min: 0,  distM: 5100,  durS: 1680, src: "app" },       // overlap cubbon again (3rd day)
  { type: "walk",  corridor: "lalbagh",         daysAgo: 0, hour: 7,  min: 0,  distM: 2900,  durS: 2100, src: "googleFit" },
  { type: "cycle", corridor: "koramangala",     daysAgo: 0, hour: 7,  min: 30, distM: 13000, durS: 2700, src: "strava" },
  { type: "run",   corridor: "indiranagar",     daysAgo: 0, hour: 6,  min: 15, distM: 7400,  durS: 2340, src: "app" },
  { type: "walk",  corridor: "indiranagar",     daysAgo: 0, hour: 6,  min: 30, distM: 3200,  durS: 2400, src: "appleFitness" }, // overlaps indiranagar today
  { type: "cycle", corridor: "hebbal",          daysAgo: 0, hour: 8,  min: 0,  distM: 16000, durS: 3000, src: "strava" },
  { type: "run",   corridor: "electronic_city", daysAgo: 0, hour: 5,  min: 45, distM: 9600,  durS: 3120, src: "app" },
  { type: "walk",  corridor: "bannerghatta",    daysAgo: 0, hour: 7,  min: 0,  distM: 4100,  durS: 3000, src: "googleFit" },
  { type: "cycle", corridor: "whitefield",      daysAgo: 0, hour: 9,  min: 0,  distM: 21000, durS: 4200, src: "strava" },
  { type: "run",   corridor: "ulsoor_lake",     daysAgo: 0, hour: 6,  min: 30, distM: 4700,  durS: 1560, src: "app" },
];

// ─── 20 Bengaluru users ──────────────────────────────────────────────────────
const BENGALURU_USERS = [
  "aditya_blr", "bhavna_blr", "chetan_blr", "deepa_blr",
  "esha_blr",   "farhan_blr", "gayatri_blr","harish_blr",
  "ishaan_blr", "jaya_blr",   "karthik_blr","lakshmi_blr",
  "manoj_blr",  "nandini_blr","omkar_blr",  "preethi_blr",
  "quincy_blr", "rohini_blr", "sanjay_blr", "tejaswi_blr"
];

// ─── Main seed function ───────────────────────────────────────────────────────
const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected");

    // 1. Create / upsert Bengaluru users (keep existing users intact)
    const passwordHash = await bcrypt.hash("password123", 10);
    const userDocs = [];

    for (const username of BENGALURU_USERS) {
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

    // 2. Wipe old activities for these users only (safe re-run)
    const userIds = userDocs.map((u) => u._id);
    const deleted = await Activity.deleteMany({ userId: { $in: userIds } });
    console.log(`\n🗑️  Cleared ${deleted.deletedCount} old activities for Bengaluru users`);

    // 3. Insert activities — round-robin assign to users
    const corridorKeys = Object.keys(CORRIDORS);
    const activities = [];

    ACTIVITY_TEMPLATES.forEach((tmpl, idx) => {
      const user = userDocs[idx % userDocs.length];
      const anchor = CORRIDORS[tmpl.corridor];
      const numPoints = tmpl.type === "cycle" ? 14 : 10;
      const spread = tmpl.type === "cycle" ? 1.5 : 0.6;
      const coords = generateRoute(anchor, numPoints, spread);
      const startTime = buildStartTime(tmpl.daysAgo, tmpl.hour, tmpl.min);
      const endTime = new Date(startTime.getTime() + tmpl.durS * 1000);
      const avgSpeed = parseFloat(((tmpl.distM / tmpl.durS) * 3.6).toFixed(2)); // km/h

      activities.push({
        userId: user._id,
        activityType: tmpl.type,
        source: tmpl.src,
        distanceMeters: tmpl.distM,
        durationSeconds: tmpl.durS,
        avgSpeed,
        startTime,
        endTime,
        route: {
          type: "LineString",
          coordinates: coords,
        },
      });
    });

    await Activity.insertMany(activities);
    console.log(`\n✅ Seeded ${activities.length} activities across 3 days in Bengaluru`);

    // Summary
    console.log("\n📊 Summary by day:");
    [0, 1, 2].forEach((d) => {
      const label = d === 0 ? "Today (Mar 13)" : d === 1 ? "Yesterday (Mar 12)" : "Day before (Mar 11)";
      const count = activities.filter((_, i) => ACTIVITY_TEMPLATES[i].daysAgo === d).length;
      console.log(`   ${label}: ${count} activities`);
    });

    console.log("\n🗺️  Overlapping corridors (intentional):");
    console.log("   • Cubbon Park — run/walk/cycle across all 3 days");
    console.log("   • Koramangala — run + walk on same day (Mar 11 & today)");
    console.log("   • Indiranagar — run + cycle overlap (today)");
    console.log("   • Hebbal Lake — run + walk same time window (Mar 12)");
    console.log("   • Whitefield  — cycle on all 3 days\n");

    process.exit(0);
  } catch (err) {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  }
};

seed();
