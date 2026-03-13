const mongoose = require('mongoose');

const challengeSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'completed'],
    default: 'active'
  },
  exerciseType: {
    type: String,
    enum: ['squat', 'pushup', 'mixed'],
    default: 'squat'
  },
  targetSquats: {
    type: Number,
    default: 0
  },
  targetPushups: {
    type: Number,
    default: 0
  },
  teams: [
    {
      teamName: { type: String, required: true },
      members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      totalSquats: { type: Number, default: 0 },
      totalPushups: { type: Number, default: 0 },
      startedWorkoutAt: { type: Date, default: null },
      completedAt: { type: Date, default: null },
      timeTakenMs: { type: Number, default: null }
    }
  ],
  host: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  winnerTeam: {
    type: String,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('Challenge', challengeSchema);
