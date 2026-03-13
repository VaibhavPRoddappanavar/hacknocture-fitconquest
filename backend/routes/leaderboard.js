const express = require('express');
const User = require('../models/User');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const type = req.query.type || 'global';
    const value = req.query.value;

    let filter = {};
    if (type === 'city' && value) {
      filter = { "location.city": value };
    } else if (type === 'state' && value) {
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
      .sort({ "stats.totalSquats": -1 })
      .select('username stats location')
      .limit(limit);

    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
