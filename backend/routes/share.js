const express = require('express');
const jwt = require('jsonwebtoken');
const Activity = require('../models/Activity');
const User = require('../models/User');

const router = express.Router();

router.get('/static-map', async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const zoom = Number(req.query.zoom || 12);
    const width = Math.min(Number(req.query.width || 900), 1200);
    const height = Math.min(Number(req.query.height || 500), 800);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: 'lat and lng are required numeric query params' });
    }

    const staticUrl =
      `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}` +
      `&zoom=${zoom}&size=${width}x${height}&maptype=mapnik`;

    const mapResponse = await fetch(staticUrl);
    if (!mapResponse.ok) {
      return res.status(502).json({ error: 'Failed to fetch static map image' });
    }

    const arrayBuffer = await mapResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader('Content-Type', mapResponse.headers.get('content-type') || 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=600');
    res.send(buffer);
  } catch (err) {
    console.error('Static map proxy error:', err);
    res.status(500).json({ error: 'Failed to load static map image' });
  }
});

function getTimeWindowStart(timeFilter) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (timeFilter === 'daily') {
    start.setDate(start.getDate() - 1);
    return start;
  }
  if (timeFilter === 'weekly') {
    start.setDate(start.getDate() - 7);
    return start;
  }
  if (timeFilter === 'monthly') {
    start.setDate(start.getDate() - 30);
    return start;
  }
  return null;
}

function toWords(text) {
  return (text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

function enforceFiftyWords(caption) {
  const fallback =
    'Completed another focused fitness session today and climbed the leaderboard with steady progress. Every step, ride, and minute counts toward consistency. Proud of this momentum and grateful for the challenge. Let us keep pushing, stay disciplined, and inspire each other daily. #FitConquest #DailyMap #FitnessJourney';

  let words = toWords(caption);

  if (words.length === 50) {
    return words.join(' ');
  }

  if (words.length > 50) {
    return words.slice(0, 50).join(' ');
  }

  const fallbackWords = toWords(fallback);
  let index = 0;
  while (words.length < 50) {
    words.push(fallbackWords[index % fallbackWords.length]);
    index += 1;
  }
  return words.join(' ');
}

function getPathCoordinates(route) {
  if (!route || !route.type || !route.coordinates) {
    return [];
  }

  if (route.type === 'LineString' && Array.isArray(route.coordinates)) {
    return route.coordinates;
  }

  if (route.type === 'Polygon' && Array.isArray(route.coordinates) && Array.isArray(route.coordinates[0])) {
    return route.coordinates[0];
  }

  return [];
}

function getMapMetaFromActivity(activity) {
  const points = getPathCoordinates(activity?.route);
  if (!points.length) {
    return {
      center: { lat: 12.9716, lng: 77.5946 },
      mapBox: null,
      routePoints: [],
      mapImageUrl:
        'https://staticmap.openstreetmap.de/staticmap.php?center=12.9716,77.5946&zoom=12&size=900x500&maptype=mapnik',
    };
  }

  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  points.forEach((point) => {
    const lng = Number(point[0]);
    const lat = Number(point[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  });

  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;

  const mapImageUrl =
    `https://staticmap.openstreetmap.de/staticmap.php?center=${centerLat},${centerLng}` +
    '&zoom=12&size=900x500&maptype=mapnik' +
    `&markers=${centerLat},${centerLng},red-pushpin`;

  return {
    center: { lat: centerLat, lng: centerLng },
    mapBox: {
      minLat,
      maxLat,
      minLng,
      maxLng,
    },
    routePoints: points
      .slice(0, 1500)
      .map((point) => ({ lat: Number(point[1]), lng: Number(point[0]) }))
      .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng)),
    mapImageUrl,
  };
}

router.post('/instagram-caption', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('username');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const mode = req.body?.mode === 'cycle' ? 'cycle' : 'walk';
    const timeFilter = ['daily', 'weekly', 'monthly', 'overall'].includes(req.body?.timeFilter)
      ? req.body.timeFilter
      : 'daily';
    const sortMetric = ['area', 'distance', 'time'].includes(req.body?.sortMetric)
      ? req.body.sortMetric
      : 'distance';

    const filter = { activityType: mode };
    const since = getTimeWindowStart(timeFilter);
    if (since) {
      filter.startTime = { $gte: since };
    }

    const allActivities = await Activity.find(filter)
      .populate('userId', 'username')
      .sort({ startTime: -1 })
      .lean();

    const userActivities = allActivities.filter(
      (activity) => activity.userId && String(activity.userId._id) === String(user._id),
    );

    if (!userActivities.length) {
      return res.status(400).json({ error: 'No activities found for selected filters' });
    }

    const userDistanceM = userActivities.reduce((acc, item) => acc + (item.distanceMeters || 0), 0);
    const userDurationSec = userActivities.reduce((acc, item) => acc + (item.durationSeconds || 0), 0);
    const userAreaSqM = userActivities.reduce((acc, item) => acc + (item.areaSquareMeters || 0), 0);

    const totalsByUser = new Map();
    allActivities.forEach((activity) => {
      if (!activity.userId?._id) return;
      const key = String(activity.userId._id);
      if (!totalsByUser.has(key)) {
        totalsByUser.set(key, {
          userId: key,
          username: activity.userId.username,
          area: 0,
          distance: 0,
          time: 0,
        });
      }
      const summary = totalsByUser.get(key);
      summary.area += activity.areaSquareMeters || 0;
      summary.distance += activity.distanceMeters || 0;
      summary.time += activity.durationSeconds || 0;
    });

    const scored = Array.from(totalsByUser.values()).map((entry) => {
      const score = sortMetric === 'area' ? entry.area : sortMetric === 'time' ? entry.time : entry.distance;
      return { ...entry, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const rank = Math.max(1, scored.findIndex((entry) => entry.userId === String(user._id)) + 1);

    const latestActivity = userActivities[0];
    const mapMeta = getMapMetaFromActivity(latestActivity);

    const distanceKm = Number((userDistanceM / 1000).toFixed(2));
    const durationMin = Math.round(userDurationSec / 60);
    const areaSqKm = Number((userAreaSqM / 1_000_000).toFixed(3));

    let caption = `${user.username} crushed today's ${mode} session with ${distanceKm} km in ${durationMin} minutes and reached rank #${rank}.`; 

    if (process.env.GEMINI_API_KEY) {
      const prompt = [
        'Write exactly 50 words for an Instagram fitness post.',
        'Tone: energetic, confident, community-friendly.',
        `User: ${user.username}.`,
        `Activity mode: ${mode}.`,
        `Time filter: ${timeFilter}.`,
        `Distance: ${distanceKm} km.`,
        `Time: ${durationMin} minutes.`,
        `Area covered: ${areaSqKm} square kilometers.`,
        `Leaderboard rank: #${rank}.`,
        'Include 2 short relevant hashtags at the end.',
        'Return plain text only.',
      ].join(' ');

      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 140,
            },
          }),
        },
      );

      if (geminiResponse.ok) {
        const geminiJson = await geminiResponse.json();
        const text =
          geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text ||
          geminiJson?.candidates?.[0]?.content?.parts?.map((part) => part.text).join(' ') ||
          caption;
        caption = text;
      }
    }

    const finalCaption = enforceFiftyWords(caption);

    res.json({
      caption: finalCaption,
      shareData: {
        userId: String(user._id),
        username: user.username,
        mode,
        timeFilter,
        sortMetric,
        rank,
        distanceMeters: userDistanceM,
        distanceKm,
        durationSeconds: userDurationSec,
        durationMinutes: durationMin,
        areaSquareMeters: userAreaSqM,
        areaSquareKm: areaSqKm,
        mapCenter: mapMeta.center,
        mapBox: mapMeta.mapBox,
        routePoints: mapMeta.routePoints,
        mapImageUrl: mapMeta.mapImageUrl,
        activityCount: userActivities.length,
      },
    });
  } catch (err) {
    console.error('Instagram caption generation failed:', err);
    res.status(500).json({ error: 'Failed to generate Instagram content' });
  }
});

module.exports = router;