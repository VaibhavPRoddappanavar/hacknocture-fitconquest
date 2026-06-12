const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const WorkoutSession = require("../models/WorkoutSession");

const router = express.Router();

const EXERCISE_CATALOG = [
  {
    id: "squat",
    name: "Squats",
    category: "lower-body",
    tracking: "ai",
    description: "Build lower-body strength with AI rep tracking.",
  },
  {
    id: "pushup",
    name: "Push-ups",
    category: "upper-body",
    tracking: "ai",
    description: "Train chest, shoulders, and core with AI rep tracking.",
  },
  {
    id: "jumping_jack",
    name: "Jumping Jacks",
    category: "cardio",
    tracking: "manual",
    description: "Quick full-body warm-up and cardio movement.",
  },
  {
    id: "burpee",
    name: "Burpees",
    category: "full-body",
    tracking: "manual",
    description: "High-intensity conditioning and endurance exercise.",
  },
  {
    id: "lunge",
    name: "Lunges",
    category: "lower-body",
    tracking: "manual",
    description: "Improve leg strength, balance, and stability.",
  },
  {
    id: "plank",
    name: "Plank",
    category: "core",
    tracking: "manual",
    description: "Build core stability with timed holds.",
  },
  {
    id: "mountain_climber",
    name: "Mountain Climbers",
    category: "cardio-core",
    tracking: "manual",
    description: "Fast-paced core and cardio challenge.",
  },
];

const EXERCISE_IDS = new Set(EXERCISE_CATALOG.map((exercise) => exercise.id));

const protect = async (req, res, next) => {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.split(" ")[1] : null;
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ error: "User not found" });

    req.user = user;
    return next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

router.get("/exercises", (req, res) => {
  res.json(EXERCISE_CATALOG);
});

router.post("/solo", protect, async (req, res) => {
  try {
    const {
      exerciseType,
      reps = 0,
      durationSec = 0,
      source = "manual",
    } = req.body;

    if (!exerciseType || !EXERCISE_IDS.has(exerciseType)) {
      return res.status(400).json({ error: "Invalid exercise type" });
    }

    const safeReps = Number.isFinite(Number(reps))
      ? Math.max(0, Math.floor(Number(reps)))
      : 0;
    const safeDuration = Number.isFinite(Number(durationSec))
      ? Math.max(0, Math.floor(Number(durationSec)))
      : 0;

    if (exerciseType === "plank" && safeDuration === 0) {
      return res
        .status(400)
        .json({ error: "Plank session requires durationSec > 0" });
    }

    if (exerciseType !== "plank" && safeReps === 0) {
      return res.status(400).json({ error: "Session requires reps > 0" });
    }

    const session = await WorkoutSession.create({
      user: req.user._id,
      mode: "solo",
      exerciseType,
      reps: safeReps,
      durationSec: safeDuration,
      source: source === "ai" ? "ai" : "manual",
    });

    req.user.stats = req.user.stats || {};
    req.user.stats.totalSoloWorkouts =
      (req.user.stats.totalSoloWorkouts || 0) + 1;

    const repContribution = exerciseType === "plank" ? safeDuration : safeReps;
    req.user.stats.totalReps =
      (req.user.stats.totalReps || 0) + repContribution;

    req.user.stats.exerciseTotals = req.user.stats.exerciseTotals || {};
    req.user.stats.exerciseTotals[exerciseType] =
      (req.user.stats.exerciseTotals[exerciseType] || 0) + repContribution;

    if (exerciseType === "squat") {
      req.user.stats.totalSquats = (req.user.stats.totalSquats || 0) + safeReps;
    }

    if (exerciseType === "pushup") {
      req.user.stats.totalPushups =
        (req.user.stats.totalPushups || 0) + safeReps;
    }

    await req.user.save();

    res.status(201).json({
      message: "Solo workout saved",
      session,
      stats: req.user.stats,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
