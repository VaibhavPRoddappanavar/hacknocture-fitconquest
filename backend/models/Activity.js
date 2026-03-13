const mongoose = require("mongoose");

const ActivitySchema = new mongoose.Schema({
  
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  activityType: {
    type: String,
    enum: ["walk", "cycle"],
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

  // Area covered (only meaningful for Polygon / loop routes)
  areaSquareMeters: {
    type: Number,
    default: 0
  },

  // Supports BOTH geometries:
  //   LineString → point-to-point path   → coordinates: [[lng,lat], ...]
  //   Polygon    → loop / region covered → coordinates: [[[lng,lat], ...]]
  route: {
    type: {
      type: String,
      enum: ["LineString", "Polygon"],
      required: true
    },
    coordinates: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    }
  }

}, { timestamps: true });

ActivitySchema.index({ route: "2dsphere" });
ActivitySchema.index({ userId: 1 });

module.exports = mongoose.model("Activity", ActivitySchema);
