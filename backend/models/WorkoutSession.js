const mongoose = require("mongoose");

const workoutSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    mode: {
      type: String,
      enum: ["solo", "challenge"],
      required: true,
    },
    exerciseType: {
      type: String,
      enum: [
        "squat",
        "pushup",
        "jumping_jack",
        "burpee",
        "lunge",
        "plank",
        "mountain_climber",
      ],
      required: true,
      index: true,
    },
    reps: {
      type: Number,
      default: 0,
    },
    durationSec: {
      type: Number,
      default: 0,
    },
    source: {
      type: String,
      enum: ["ai", "manual"],
      default: "manual",
    },
    challenge: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Challenge",
      default: null,
    },
    teamName: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("WorkoutSession", workoutSessionSchema);
