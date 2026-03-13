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

    const leaderboard = await User.find(filter)
      .sort({ "stats.totalSquats": -1 })
      .select('username stats location')
      .limit(50); // Top 50

    res.json(leaderboard);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
