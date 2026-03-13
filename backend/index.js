const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const { Server } = require('socket.io');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const challengeRoutes = require('./routes/challenges');
const leaderboardRoutes = require('./routes/leaderboard');
const activityRoutes = require('./routes/activities');
const shareRoutes = require('./routes/share');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/challenges', challengeRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/share', shareRoutes);

// Database Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.error(err));

// Socket.io for Real-time Squat Loop
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join_challenge', (challengeId) => {
    socket.join(challengeId);
    console.log(`Socket ${socket.id} joined challenge ${challengeId}`);
  });

  socket.on('start_challenge', async (challengeId) => {
    io.to(challengeId).emit('challenge_started');
  });

  socket.on('squat_performed', async ({ challengeId, teamId, userId, count }) => {
    // In a real app we would update the DB less frequently or queue it.
    // For this simulation, we'll update it here directly or broadcast to others.
    
    const Challenge = require('./models/Challenge');
    try {
      const challenge = await Challenge.findById(challengeId);
      if (challenge && challenge.status === 'active') {
        const team = challenge.teams.id(teamId);
        if (team) {
          team.totalSquats += count;
          await challenge.save();
          
          // Re-fetch challenge completely to ensure correct populating (or just proper format) for all clients
          const updatedChallenge = await Challenge.findById(challengeId)
                .populate('teams.members', 'username stats location');
                
          // Broadcast to everyone in the room
          io.to(challengeId).emit('score_update', {
            challengeId,
            teams: updatedChallenge.teams,
            winnerTeam: updatedChallenge.winnerTeam
          });

          // Also increment user squat
          const User = require('./models/User');
          const user = await User.findById(userId);
          if (user) {
            user.stats.totalSquats += count;
            await user.save();
          }

          if (team.totalSquats >= challenge.targetSquats && !challenge.winnerTeam) {
             challenge.status = 'completed';
             challenge.winnerTeam = team.teamName;
             await challenge.save();
             io.to(challengeId).emit('challenge_completed', {
                winnerTeam: team.teamName
             });
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));