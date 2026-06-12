const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const Activity = require("../models/Activity");

function getBearerUserId(req) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return null;
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  return decoded.id;
}

function decodePolylineToLngLat(polyline) {
  if (!polyline || typeof polyline !== "string") return [];

  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates = [];

  while (index < polyline.length) {
    let result = 0;
    let shift = 0;
    let b;

    do {
      b = polyline.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20 && index < polyline.length + 1);

    const dLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dLat;

    result = 0;
    shift = 0;
    do {
      b = polyline.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20 && index < polyline.length + 1);

    const dLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dLng;

    coordinates.push([lng / 1e5, lat / 1e5]);
  }

  return coordinates;
}

function getStravaRoute(item) {
  const summaryPolyline = item?.map?.summary_polyline;
  const decoded = decodePolylineToLngLat(summaryPolyline);
  if (decoded.length >= 2) {
    return { type: "LineString", coordinates: decoded };
  }

  const start = Array.isArray(item?.start_latlng) ? item.start_latlng : null;
  const end = Array.isArray(item?.end_latlng) ? item.end_latlng : null;
  if (start?.length === 2 && end?.length === 2) {
    return {
      type: "LineString",
      coordinates: [
        [Number(start[1]), Number(start[0])],
        [Number(end[1]), Number(end[0])],
      ],
    };
  }

  return {
    type: "LineString",
    coordinates: [
      [77.5946, 12.9716],
      [77.5961, 12.973],
    ],
  };
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function routeDistanceMeters(coords) {
  if (!Array.isArray(coords) || coords.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1];
    const curr = coords[i];
    if (!Array.isArray(prev) || !Array.isArray(curr)) continue;
    const [lng1, lat1] = prev;
    const [lng2, lat2] = curr;
    if (
      !Number.isFinite(lat1) ||
      !Number.isFinite(lng1) ||
      !Number.isFinite(lat2) ||
      !Number.isFinite(lng2)
    ) {
      continue;
    }
    total += haversineMeters(lat1, lng1, lat2, lng2);
  }
  return total;
}

/**
 * GET /api/activities
 * Query params:
 *   days   - number of past days to include (default: 3)
 *   type   - filter by activityType: run | walk | cycle (optional)
 *   limit  - max results (default: 200)
 *
 * Returns activities with populated userId -> { _id, username }
 */
router.get("/", async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 3;
    const limit = parseInt(req.query.limit) || 200;
    const type = req.query.type; // optional

    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0); // start of that day

    const filter = { startTime: { $gte: since } };
    if (type && ["walk", "cycle"].includes(type)) {
      filter.activityType = type;
    }

    const activities = await Activity.find(filter)
      .populate("userId", "username")
      .sort({ startTime: -1 })
      .limit(limit)
      .lean();

    res.json(activities);
  } catch (err) {
    console.error("Activities fetch error:", err);
    res.status(500).json({ error: "Failed to fetch activities" });
  }
});

/**
 * POST /api/activities
 * Body: {
 *   activityType: "walk" | "cycle",
 *   startTime: ISO string,
 *   endTime: ISO string,
 *   route: { type: "LineString", coordinates: [[lng,lat], ...] }
 * }
 * Requires Authorization: Bearer <token>
 */
router.post("/", async (req, res) => {
  try {
    const userId = getBearerUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const activityType = req.body?.activityType === "cycle" ? "cycle" : "walk";
    const startTime = new Date(req.body?.startTime);
    const endTime = new Date(req.body?.endTime);
    const coordinates = req.body?.route?.coordinates;

    if (
      !Number.isFinite(startTime.getTime()) ||
      !Number.isFinite(endTime.getTime())
    ) {
      return res.status(400).json({ error: "Invalid start/end time" });
    }

    const durationSeconds = Math.floor(
      (endTime.getTime() - startTime.getTime()) / 1000,
    );
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      return res.status(400).json({ error: "Duration must be greater than 0" });
    }

    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      return res
        .status(400)
        .json({ error: "Route must contain at least 2 points" });
    }

    const normalizedCoords = coordinates
      .map((pt) => {
        if (!Array.isArray(pt) || pt.length < 2) return null;
        const lng = Number(pt[0]);
        const lat = Number(pt[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return [lng, lat];
      })
      .filter(Boolean);

    if (normalizedCoords.length < 2) {
      return res.status(400).json({ error: "Route coordinates are invalid" });
    }

    const distanceMeters = routeDistanceMeters(normalizedCoords);
    if (!Number.isFinite(distanceMeters) || distanceMeters <= 1) {
      return res.status(400).json({ error: "Tracked distance is too short" });
    }

    const avgSpeed = (distanceMeters / durationSeconds) * 3.6;

    const created = await Activity.create({
      userId,
      activityType,
      source: "app",
      distanceMeters: Number(distanceMeters.toFixed(2)),
      durationSeconds,
      avgSpeed: Number(avgSpeed.toFixed(2)),
      startTime,
      endTime,
      areaSquareMeters: 0,
      route: {
        type: "LineString",
        coordinates: normalizedCoords,
      },
    });

    const hydrated = await Activity.findById(created._id)
      .populate("userId", "username")
      .lean();

    return res.status(201).json(hydrated);
  } catch (err) {
    console.error("Activity create error:", err);
    return res.status(500).json({ error: "Failed to save activity" });
  }
});

/**
 * POST /api/activities/import/strava
 * Body: { activities: [{ activityType, distanceMeters, durationSeconds, startTime, endTime?, route? }] }
 * Requires Authorization: Bearer <token>
 */
router.post("/import/strava", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    const payload = Array.isArray(req.body?.activities)
      ? req.body.activities
      : [];
    if (payload.length === 0) {
      return res.status(400).json({ error: "No activities provided" });
    }

    const docs = payload
      .slice(0, 1000)
      .map((row) => {
        const activityType = row.activityType === "cycle" ? "cycle" : "walk";
        const distanceMeters = Number(row.distanceMeters);
        const durationSeconds = Number(row.durationSeconds);
        const startTime = new Date(row.startTime);
        const endTime = row.endTime
          ? new Date(row.endTime)
          : new Date(startTime.getTime() + durationSeconds * 1000);

        if (!Number.isFinite(distanceMeters) || distanceMeters <= 0)
          return null;
        if (!Number.isFinite(durationSeconds) || durationSeconds <= 0)
          return null;
        if (!Number.isFinite(startTime.getTime())) return null;
        if (!Number.isFinite(endTime.getTime())) return null;

        // Fallback route around Bengaluru center if CSV row has no path geometry.
        const fallbackRoute = {
          type: "LineString",
          coordinates: [
            [77.5946, 12.9716],
            [77.5961, 12.973],
          ],
        };

        const route =
          row.route && row.route.type && row.route.coordinates
            ? row.route
            : fallbackRoute;
        const avgSpeed = (distanceMeters / durationSeconds) * 3.6;

        return {
          userId,
          activityType,
          source: "strava",
          distanceMeters,
          durationSeconds,
          avgSpeed: Number.isFinite(avgSpeed) ? Number(avgSpeed.toFixed(2)) : 0,
          startTime,
          endTime,
          areaSquareMeters: Number(row.areaSquareMeters) || 0,
          route,
        };
      })
      .filter(Boolean);

    if (docs.length === 0) {
      return res.status(400).json({ error: "No valid activities to import" });
    }

    const created = await Activity.insertMany(docs, { ordered: false });
    return res.status(201).json({ imported: created.length });
  } catch (err) {
    console.error("Strava import error:", err);
    return res.status(500).json({ error: "Failed to import activities" });
  }
});

/**
 * GET /api/activities/strava/connect-url
 * Returns Strava OAuth authorize URL.
 */
const buildStravaConnectUrlHandler = async (req, res) => {
  try {
    const clientId = process.env.STRAVA_CLIENT_ID;
    if (!clientId) {
      return res
        .status(500)
        .json({ error: "STRAVA_CLIENT_ID is not configured" });
    }

    const frontendBase = process.env.FRONTEND_URL || "http://localhost:3000";
    const redirectUri = process.env.STRAVA_REDIRECT_URI || `${frontendBase}/`;
    const state = req.query.state ? String(req.query.state) : "fitconquest";

    const authorizeUrl = new URL("https://www.strava.com/oauth/authorize");
    authorizeUrl.searchParams.set("client_id", clientId);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("approval_prompt", "auto");
    authorizeUrl.searchParams.set("scope", "read,activity:read_all");
    authorizeUrl.searchParams.set("state", state);

    return res.json({ url: authorizeUrl.toString() });
  } catch (err) {
    console.error("Strava connect URL error:", err);
    return res
      .status(500)
      .json({ error: "Failed to generate Strava connect URL" });
  }
};

router.get("/strava/connect-url", buildStravaConnectUrlHandler);
router.get("/strava/connect", buildStravaConnectUrlHandler);

/**
 * POST /api/activities/strava/sync
 * Body: { code: string }
 * Exchanges OAuth code, fetches activities from Strava, and imports them.
 */
router.post("/strava/sync", async (req, res) => {
  try {
    const userId = getBearerUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const code = req.body?.code;
    if (!code || typeof code !== "string") {
      return res
        .status(400)
        .json({ error: "Missing Strava authorization code" });
    }

    const clientId = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return res
        .status(500)
        .json({ error: "Strava credentials are not configured" });
    }

    const tokenRes = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
      }),
    });

    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok || !tokenJson?.access_token) {
      return res.status(400).json({
        error: tokenJson?.message || "Failed to authorize with Strava",
      });
    }

    const activitiesRes = await fetch(
      "https://www.strava.com/api/v3/athlete/activities?per_page=200&page=1",
      {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      },
    );

    const stravaActivities = await activitiesRes.json();
    if (!activitiesRes.ok || !Array.isArray(stravaActivities)) {
      return res
        .status(400)
        .json({ error: "Failed to fetch Strava activities" });
    }

    const incoming = stravaActivities
      .map((item) => {
        const distanceMeters = Number(item?.distance);
        const durationSeconds = Number(item?.moving_time || item?.elapsed_time);
        const startTime = new Date(item?.start_date || item?.start_date_local);

        if (!Number.isFinite(distanceMeters) || distanceMeters <= 0)
          return null;
        if (!Number.isFinite(durationSeconds) || durationSeconds <= 0)
          return null;
        if (!Number.isFinite(startTime.getTime())) return null;

        const endTime = new Date(startTime.getTime() + durationSeconds * 1000);
        const type = String(item?.type || "").toLowerCase();
        const activityType =
          type.includes("ride") || type.includes("cycle") ? "cycle" : "walk";

        return {
          externalId: `strava:${item.id}`,
          userId,
          activityType,
          source: "strava",
          distanceMeters,
          durationSeconds,
          avgSpeed: Number(
            ((distanceMeters / durationSeconds) * 3.6).toFixed(2),
          ),
          startTime,
          endTime,
          areaSquareMeters: 0,
          route: getStravaRoute(item),
        };
      })
      .filter(Boolean);

    if (!incoming.length) {
      return res.status(200).json({ imported: 0, skipped: 0 });
    }

    const existing = await Activity.find({
      userId,
      externalId: { $in: incoming.map((d) => d.externalId) },
    })
      .select("externalId")
      .lean();

    const existingIds = new Set(existing.map((e) => e.externalId));
    const toCreate = incoming.filter((d) => !existingIds.has(d.externalId));
    const toUpdate = incoming.filter((d) => existingIds.has(d.externalId));

    let imported = 0;
    if (toCreate.length) {
      const created = await Activity.insertMany(toCreate, { ordered: false });
      imported = created.length;
    }

    let updated = 0;
    if (toUpdate.length) {
      const writeOps = toUpdate.map((doc) => ({
        updateOne: {
          filter: { userId, externalId: doc.externalId },
          update: {
            $set: {
              activityType: doc.activityType,
              distanceMeters: doc.distanceMeters,
              durationSeconds: doc.durationSeconds,
              avgSpeed: doc.avgSpeed,
              startTime: doc.startTime,
              endTime: doc.endTime,
              route: doc.route,
            },
          },
        },
      }));

      const result = await Activity.bulkWrite(writeOps, { ordered: false });
      updated = Number(result.modifiedCount || 0);
    }

    return res.json({
      imported,
      updated,
      skipped: incoming.length - imported - toUpdate.length,
    });
  } catch (err) {
    console.error("Strava sync error:", err);
    return res.status(500).json({ error: "Failed to sync Strava activities" });
  }
});

module.exports = router;
