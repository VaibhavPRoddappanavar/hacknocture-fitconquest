const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const Activity = require("../models/Activity");

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

module.exports = router;
