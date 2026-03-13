const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const { Server } = require('socket.io');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const challengeRoutes = require('./routes/challenges');
const leaderboardRoutes = require('./routes/leaderboard');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/challenges', challengeRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.error(err));

// ── Check if team completed ─────────────────────────────────────────────────
function isTeamComplete(challenge, team) {
  const type = challenge.exerciseType || 'squat';
  if (type === 'squat') return team.totalSquats >= challenge.targetSquats;
  if (type === 'pushup') return team.totalPushups >= challenge.targetPushups;
  if (type === 'mixed') return team.totalSquats >= challenge.targetSquats && team.totalPushups >= challenge.targetPushups;
  return false;
}

// ── Handle a rep ─────────────────────────────────────────────────────────────
async function handleRep(challengeId, teamId, userId, count, exerciseField) {
  const Challenge = require('./models/Challenge');
  const User = require('./models/User');

  try {
    const challenge = await Challenge.findById(challengeId);
    if (!challenge || challenge.status !== 'active') return;

    const team = challenge.teams.id(teamId);
    if (!team) return;
    if (team.completedAt) return; // already finished, ignore

    if (exerciseField === 'squats') team.totalSquats += count;
    else team.totalPushups += count;

    // Check if this team just completed
    if (isTeamComplete(challenge, team) && !team.completedAt) {
      team.completedAt = new Date();
      if (team.startedWorkoutAt) {
        team.timeTakenMs = team.completedAt.getTime() - team.startedWorkoutAt.getTime();
      }
    }

    await challenge.save();

    const updated = await Challenge.findById(challengeId)
      .populate('teams.members', 'username stats location');

    io.to(challengeId).emit('score_update', {
      challengeId,
      teams: updated.teams,
    });

    // Update user stats
    const user = await User.findById(userId);
    if (user) {
      user.stats.totalSquats += count;
      await user.save();
    }
  } catch (err) {
    console.error(err);
  }
}

// ── Socket ───────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join_challenge', (challengeId) => {
    socket.join(challengeId);
  });

  // Team starts their workout
  socket.on('team_start_workout', async ({ challengeId, teamId }) => {
    const Challenge = require('./models/Challenge');
    try {
      const challenge = await Challenge.findById(challengeId);
      if (!challenge) return;
      const team = challenge.teams.id(teamId);
      if (team && !team.startedWorkoutAt) {
        team.startedWorkoutAt = new Date();
        await challenge.save();
        console.log(`Team ${team.teamName} started workout for challenge ${challengeId}`);
      }
    } catch (e) { console.error(e); }
  });

  socket.on('squat_performed', async ({ challengeId, teamId, userId, count }) => {
    await handleRep(challengeId, teamId, userId, count, 'squats');
  });

  socket.on('pushup_performed', async ({ challengeId, teamId, userId, count }) => {
    await handleRep(challengeId, teamId, userId, count, 'pushups');
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));