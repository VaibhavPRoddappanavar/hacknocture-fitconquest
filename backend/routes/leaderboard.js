const express = require("express");
const User = require("../models/User");
const Challenge = require("../models/Challenge");

const router = express.Router();

// ── Global user leaderboard (existing) ───────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const type = req.query.type || "global";
    const value = req.query.value;

    let filter = {};
    if (type === "city" && value) {
      filter = { "location.city": value };
    } else if (type === "state" && value) {
      filter = { "location.state": value };
    }

    // For daily/weekly/monthly — currently the User model only has
    // cumulative totalSquats (no per-day logs). We return the same
    // sorted list with a different limit to visually differentiate.
    // TODO: Add squatLogs with timestamps for real time-based filtering.
    let limit = 50;
    if (type === 'daily') {
      limit = 20;
    } else if (type === 'weekly') {
      limit = 30;
    } else if (type === 'monthly') {
      limit = 40;
    }

    const leaderboard = await User.find(filter)
      .sort({ "stats.totalReps": -1, "stats.totalSquats": -1 })
      .select("username stats location")
      .limit(50);

    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Challenge-specific team leaderboard ──────────────────────────────────────
router.get("/challenge/:id", async (req, res) => {
  try {
    const challenge = await Challenge.findById(req.params.id).populate(
      "teams.members",
      "username stats location",
    );

    if (!challenge)
      return res.status(404).json({ error: "Challenge not found" });

    const type = challenge.exerciseType || "squat";

    // Build team ranking
    const teamsRanked = challenge.teams.map((team) => {
      let totalReps = 0;
      if (type === "squat") totalReps = team.totalSquats;
      else if (type === "pushup") totalReps = team.totalPushups;
      else totalReps = team.totalSquats + team.totalPushups;

      const targetTotal =
        (type === "squat" ? challenge.targetSquats : 0) +
        (type === "pushup" ? challenge.targetPushups : 0) +
        (type === "mixed"
          ? challenge.targetSquats + challenge.targetPushups
          : 0);

      const completed =
        (type === "squat" && team.totalSquats >= challenge.targetSquats) ||
        (type === "pushup" && team.totalPushups >= challenge.targetPushups) ||
        (type === "mixed" &&
          team.totalSquats >= challenge.targetSquats &&
          team.totalPushups >= challenge.targetPushups);

      return {
        teamName: team.teamName,
        members: team.members,
        totalSquats: team.totalSquats,
        totalPushups: team.totalPushups,
        totalReps,
        completed,
        completedAt: team.completedAt,
        timeTakenMs: team.timeTakenMs,
        timeTakenFormatted: team.timeTakenMs
          ? formatTime(team.timeTakenMs)
          : null,
      };
    });

    // Sort: completed teams first (by time), then incomplete (by reps desc)
    teamsRanked.sort((a, b) => {
      if (a.completed && b.completed) {
        return (a.timeTakenMs || Infinity) - (b.timeTakenMs || Infinity);
      }
      if (a.completed && !b.completed) return -1;
      if (!a.completed && b.completed) return 1;
      return b.totalReps - a.totalReps;
    });

    res.json({
      challengeId: challenge._id,
      title: challenge.title,
      exerciseType: type,
      targetSquats: challenge.targetSquats,
      targetPushups: challenge.targetPushups,
      status: challenge.status,
      winnerTeam: challenge.winnerTeam,
      startedAt: challenge.startedAt,
      teams: teamsRanked,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── All challenges summary for leaderboard overview ──────────────────────────
router.get("/challenges", async (req, res) => {
  try {
    const challenges = await Challenge.find()
      .populate("teams.members", "username stats")
      .sort({ createdAt: -1 });

    const summaries = challenges.map((c) => {
      const type = c.exerciseType || "squat";
      return {
        _id: c._id,
        title: c.title,
        exerciseType: type,
        status: c.status,
        winnerTeam: c.winnerTeam,
        targetSquats: c.targetSquats,
        targetPushups: c.targetPushups,
        teams: c.teams.map((t) => ({
          teamName: t.teamName,
          totalSquats: t.totalSquats,
          totalPushups: t.totalPushups,
          memberCount: t.members.length,
          completed:
            type === "squat"
              ? t.totalSquats >= c.targetSquats
              : type === "pushup"
                ? t.totalPushups >= c.targetPushups
                : t.totalSquats >= c.targetSquats &&
                  t.totalPushups >= c.targetPushups,
          timeTakenMs: t.timeTakenMs,
          timeTakenFormatted: t.timeTakenMs ? formatTime(t.timeTakenMs) : null,
        })),
      };
    });

    res.json(summaries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min > 0) return `${min}m ${sec}s`;
  return `${sec}s`;
}

module.exports = router;
