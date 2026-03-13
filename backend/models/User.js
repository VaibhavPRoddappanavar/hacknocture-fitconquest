const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  friends: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  location: {
    city: String,
    state: String,
    country: { type: String, default: 'India' }
  },
  stats: {
    totalSquats: { type: Number, default: 0 },
    challengesWon: { type: Number, default: 0 }
  }
}, { timestamps: true });

// Geographical indexes
userSchema.index({ "location.city": 1, "stats.totalSquats": -1 });
userSchema.index({ "location.state": 1, "stats.totalSquats": -1 });
userSchema.index({ "stats.totalSquats": -1 });

module.exports = mongoose.model('User', userSchema);
