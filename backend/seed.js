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
      { username: 'vishal', password: passwordHash, location: { city: 'Kochi', state: 'Kerala', country: 'India' } },
      { username: 'arjun', password: passwordHash, location: { city: 'Kochi', state: 'Kerala', country: 'India' } },
      { username: 'priya', password: passwordHash, location: { city: 'Bangalore', state: 'Karnataka', country: 'India' } },
      { username: 'rahul', password: passwordHash, location: { city: 'Bangalore', state: 'Karnataka', country: 'India' } },
      { username: 'testuser', password: passwordHash, location: { city: 'Mumbai', state: 'Maharashtra', country: 'India' } },
    ];

    const users = await User.insertMany(usersData);

    // Make them mutual friends
    for (let u of users) {
      u.friends = users.filter(x => x._id !== u._id).map(x => x._id);
      await u.save();
    }

    const hostUser = users[0];
    const friends = users.slice(1);

    const now = new Date();
    // Start time 1 minute from now, End time 30 mins from now
    const startTimeActive = new Date(now.getTime() - 60000); // already started
    const endTimeActive = new Date(now.getTime() + 30 * 60000);

    const challenge = new Challenge({
      title: "The 10k Squat Blitz 🚀",
      startTime: startTimeActive,
      endTime: endTimeActive,
      status: 'active',
      targetSquats: 10000,
      host: hostUser._id,
      teams: [
        {
          teamName: "Red",
          members: [users[0]._id, users[1]._id],
          totalSquats: 0
        },
        {
          teamName: "Blue",
          members: [users[2]._id, users[3]._id],
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
