const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./models/User');
const Challenge = require('./models/Challenge');

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected for Seeding'))
  .catch(err => console.error(err));

const seed = async () => {
  try {
    await User.deleteMany({});
    await Challenge.deleteMany({});

    const passwordHash = await bcrypt.hash('password123', 10);

    const usersData = [
      { username: 'vishal', password: passwordHash, flexCoins: 500, location: { city: 'Kochi', state: 'Kerala', country: 'India' } },
      { username: 'arjun', password: passwordHash, flexCoins: 500, location: { city: 'Kochi', state: 'Kerala', country: 'India' } },
      { username: 'priya', password: passwordHash, flexCoins: 500, location: { city: 'Bangalore', state: 'Karnataka', country: 'India' } },
      { username: 'rahul', password: passwordHash, flexCoins: 500, location: { city: 'Bangalore', state: 'Karnataka', country: 'India' } },
      { username: 'testuser', password: passwordHash, flexCoins: 500, location: { city: 'Mumbai', state: 'Maharashtra', country: 'India' } },
    ];

    const users = await User.insertMany(usersData);

    // Make them mutual friends
    for (let u of users) {
      u.friends = users.filter(x => x._id !== u._id).map(x => x._id);
      await u.save();
    }

    const hostUser = users[0];
    const friends = users.slice(1);

    // Start time 2 minutes from now, End time 30 mins from now
    const now = new Date();
    const startTimeUpcoming = new Date(now.getTime() + 2 * 60000); 
    const endTimeActive = new Date(now.getTime() + 30 * 60000);

    const challenge = new Challenge({
      title: "The 10k Squat Blitz 🚀",
      startTime: startTimeUpcoming,
      endTime: endTimeActive,
      status: 'upcoming',
      targetSquats: 10000,
      host: hostUser._id,
      teams: [
        {
          teamName: "Red",
          members: [],
          totalSquats: 0
        },
        {
          teamName: "Blue",
          members: [],
          totalSquats: 0
        }
      ]
    });

    await challenge.save();

    console.log("Database seeded with Users and a Challenge successfully!");
    process.exit();
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
};

seed();
