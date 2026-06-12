const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    friends: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    location: {
      city: String,
      state: String,
      country: { type: String, default: "India" },
    },
    stats: {
      totalSquats: { type: Number, default: 0 },
      totalPushups: { type: Number, default: 0 },
      totalReps: { type: Number, default: 0 },
      totalSoloWorkouts: { type: Number, default: 0 },
      totalChallengeWorkouts: { type: Number, default: 0 },
      exerciseTotals: {
        squat: { type: Number, default: 0 },
        pushup: { type: Number, default: 0 },
        jumping_jack: { type: Number, default: 0 },
        burpee: { type: Number, default: 0 },
        lunge: { type: Number, default: 0 },
        plank: { type: Number, default: 0 },
        mountain_climber: { type: Number, default: 0 },
      },
      challengesWon: { type: Number, default: 0 },
    },
    flexCoins: {
      type: Number,
      default: 0,
    },
    activeShield: {
      shieldType: {
        type: String,
        enum: ["none", "bronze", "silver", "gold"],
        default: "none",
      },
      expiresAt: { type: Date, default: null },
    },
  },
  { timestamps: true },
);

// Geographical indexes
userSchema.index({ "location.city": 1, "stats.totalSquats": -1 });
userSchema.index({ "location.state": 1, "stats.totalSquats": -1 });
userSchema.index({ "stats.totalSquats": -1 });
userSchema.index({ "location.city": 1, "stats.totalReps": -1 });
userSchema.index({ "location.state": 1, "stats.totalReps": -1 });
userSchema.index({ "stats.totalReps": -1 });

module.exports = mongoose.model("User", userSchema);
