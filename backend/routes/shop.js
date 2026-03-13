const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Middleware to protect routes
const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
      if (!req.user) {
         return res.status(401).json({ error: 'Not authorized, user not found' });
      }
      next();
    } catch (error) {
      res.status(401).json({ error: 'Not authorized, token failed' });
    }
  } else {
    res.status(401).json({ error: 'Not authorized, no token' });
  }
};

const SHIELD_COSTS = {
  bronze: { cost: 100, days: 1 },
  silver: { cost: 250, days: 3 },
  gold: { cost: 400, days: 5 }
};

// @route   GET /api/shop/balance
// @desc    Get current aura balance and active shield
// @access  Private
router.get('/balance', protect, async (req, res) => {
  try {
    const user = req.user;
    
    // Check if shield expired
    if (user.activeShield && user.activeShield.expiresAt && new Date() > user.activeShield.expiresAt) {
      user.activeShield = { shieldType: 'none', expiresAt: null };
      await user.save();
    }

    res.json({
      flexCoins: user.flexCoins,
      activeShield: user.activeShield
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/shop/buy-shield
// @desc    Purchase a shield with aura
// @access  Private
router.post('/buy-shield', protect, async (req, res) => {
  try {
    const { shieldType } = req.body;
    const user = req.user;

    if (!SHIELD_COSTS[shieldType]) {
      return res.status(400).json({ error: 'Invalid shield type' });
    }

    const cost = SHIELD_COSTS[shieldType].cost;

    if (user.flexCoins < cost) {
      return res.status(400).json({ error: 'Not enough Flex Coins to purchase this shield' });
    }

    // Deduct cost
    user.flexCoins -= cost;

    // Calculate expiration
    const days = SHIELD_COSTS[shieldType].days;
    // Check if they already have a shield to extend, else start new
    let newExpiration = new Date();
    if (user.activeShield && user.activeShield.expiresAt && user.activeShield.expiresAt > new Date()) {
      newExpiration = new Date(user.activeShield.expiresAt); // Extend current
    }
    newExpiration.setDate(newExpiration.getDate() + days);

    user.activeShield = {
      shieldType,
      expiresAt: newExpiration
    };

    await user.save();

    res.json({
      message: `${shieldType.charAt(0).toUpperCase() + shieldType.slice(1)} Shield purchased successfully!`,
      flexCoins: user.flexCoins,
      activeShield: user.activeShield
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// @route   POST /api/shop/sponsor
// @desc    Spend aura to buy a sponsor product
// @access  Private
router.post('/sponsor', protect, async (req, res) => {
  try {
    const { amount, productId } = req.body;
    const user = req.user;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    if (user.flexCoins < amount) {
      return res.status(400).json({ error: 'Not enough Flex Coins' });
    }

    // Deduct cost
    user.flexCoins -= amount;
    await user.save();

    res.json({
      message: `Successfully claimed sponsor product!`,
      flexCoins: user.flexCoins
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
