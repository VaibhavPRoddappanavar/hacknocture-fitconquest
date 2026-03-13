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
    enum: ['upcoming', 'active', 'completed'],
    default: 'upcoming'
  },
  targetSquats: {
    type: Number,
    required: true,
    default: 10000
  },
  teams: [
    {
      teamName: { type: String, required: true },
      members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      totalSquats: { type: Number, default: 0 }
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
