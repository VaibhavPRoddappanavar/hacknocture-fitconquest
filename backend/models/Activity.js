const mongoose = require("mongoose");

const ActivitySchema = new mongoose.Schema({
  
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  activityType: {
    type: String,
    enum: ["run", "walk", "cycle"],
    required: true
  },

  source: {
    type: String,
    enum: ["app", "strava", "googleFit", "appleFitness"],
    default: "app"
  },

  externalId: {
    type: String
  },

  distanceMeters: {
    type: Number,
    required: true
  },

  durationSeconds: {
    type: Number,
    required: true
  },

  avgSpeed: {
    type: Number
  },

  startTime: {
    type: Date,
    required: true
  },

  endTime: {
    type: Date
  },

  route: {
    type: {
      type: String,
      enum: ["LineString"],
      required: true
    },
    coordinates: {
      type: [[Number]], // [lng, lat]
      required: true
    }
  }

}, { timestamps: true });

ActivitySchema.index({ route: "2dsphere" });
ActivitySchema.index({ userId: 1 });

module.exports = mongoose.model("Activity", ActivitySchema);
