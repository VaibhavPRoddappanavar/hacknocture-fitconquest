const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');
const Challenge = require('./models/Challenge');

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected for Seeding'))
  .catch(err => console.error(err));

const reseed = async () => {
  try {
    await Challenge.deleteMany({});
    
    // Fetch users created from original seed to map them to the teams.
    const users = await User.find({});
    if(users.length < 5) {
        console.error("Not enough users in the database to build the mock teams. Please run the full node seed.js first.");
        process.exit(1);
    }
    
    // Sort generically so indices are predictable if multiple creations happened
    users.sort((a,b) => a.username.localeCompare(b.username));
    
    // E.g. [ 'arjun', 'priya', 'rahul', 'testuser', 'vishal' ]
    const hostUser = users.find(u => u.username === 'vishal') || users[0];
    const redMembers = [
        users.find(u => u.username === 'vishal')._id, 
        users.find(u => u.username === 'priya')._id
    ];

    const now = new Date();
    
    // Fake team helpers
    const fakeStart = (minsAgo) => new Date(now.getTime() - minsAgo * 60000);
    const fakeComplete = (startTime, durationMins) => {
      const completedAt = new Date(startTime.getTime() + durationMins * 60000);
      return { completedAt, timeTakenMs: durationMins * 60000 };
    };

    // CHALLENGE 1: Squat Sprint
    const c1GreenStart = fakeStart(45);
    const c1GreenDone = fakeComplete(c1GreenStart, 15);
    const c1YellowStart = fakeStart(30);

    const challenge1 = new Challenge({
      title: "Squat Sprint 🦵",
      startTime: now,
      endTime: new Date(now.getTime() + 48 * 60 * 60000), // Extended time for testing
      status: 'active',
      exerciseType: 'squat',
      targetSquats: 5,
      targetPushups: 0,
      host: hostUser._id,
      teams: [
        { teamName: "Red", members: [...redMembers], totalSquats: 0, totalPushups: 0 }, // Clean fresh start
        { teamName: "Blue", members: [users[0]._id, users[1]._id], totalSquats: 0, totalPushups: 0 },
        {
          teamName: "Green",
          members: [users[2]._id, users[3]._id], 
          totalSquats: 5, totalPushups: 0,
          startedWorkoutAt: c1GreenStart,
          completedAt: c1GreenDone.completedAt,
          timeTakenMs: c1GreenDone.timeTakenMs,
        },
        {
          teamName: "Yellow",
          members: [users[4]._id, users[0]._id],
          totalSquats: 3, totalPushups: 0,
          startedWorkoutAt: c1YellowStart,
          completedAt: null, timeTakenMs: null,
        },
      ]
    });

    // CHALLENGE 2: Pushup Blitz
    const c2OrangeStart = fakeStart(60);
    const c2OrangeDone = fakeComplete(c2OrangeStart, 12);
    const c2PurpleStart = fakeStart(50);
    const c2PurpleDone = fakeComplete(c2PurpleStart, 18);

    const challenge2 = new Challenge({
      title: "Pushup Blitz 💪",
      startTime: now,
      endTime: new Date(now.getTime() + 48 * 60 * 60000),
      status: 'active',
      exerciseType: 'pushup',
      targetSquats: 0,
      targetPushups: 5,
      host: hostUser._id,
      teams: [
        { teamName: "Red", members: [...redMembers], totalSquats: 0, totalPushups: 0 },
        { teamName: "Blue", members: [users[0]._id, users[1]._id], totalSquats: 0, totalPushups: 0 },
        {
          teamName: "Orange",
          members: [users[2]._id, users[3]._id],
          totalSquats: 0, totalPushups: 5,
          startedWorkoutAt: c2OrangeStart,
          completedAt: c2OrangeDone.completedAt,
          timeTakenMs: c2OrangeDone.timeTakenMs,
        },
        {
          teamName: "Purple",
          members: [users[4]._id, users[1]._id],
          totalSquats: 0, totalPushups: 5,
          startedWorkoutAt: c2PurpleStart,
          completedAt: c2PurpleDone.completedAt,
          timeTakenMs: c2PurpleDone.timeTakenMs,
        },
        {
          teamName: "Silver",
          members: [users[3]._id],
          totalSquats: 0, totalPushups: 2,
          startedWorkoutAt: fakeStart(25),
          completedAt: null, timeTakenMs: null,
        },
      ]
    });

    // CHALLENGE 3: Ultimate Combo
    const c3CyanStart = fakeStart(90);
    const c3CyanDone = fakeComplete(c3CyanStart, 20);
    const c3MagentaStart = fakeStart(70);

    const challenge3 = new Challenge({
      title: "Ultimate Combo 🔥",
      startTime: now,
      endTime: new Date(now.getTime() + 48 * 60 * 60000),
      status: 'active',
      exerciseType: 'mixed',
      targetSquats: 5,
      targetPushups: 5,
      host: hostUser._id,
      teams: [
        { teamName: "Red", members: [...redMembers], totalSquats: 0, totalPushups: 0 },
        { teamName: "Blue", members: [users[0]._id, users[1]._id], totalSquats: 0, totalPushups: 0 },
        {
          teamName: "Cyan",
          members: [users[2]._id, users[3]._id],
          totalSquats: 5, totalPushups: 5,
          startedWorkoutAt: c3CyanStart,
          completedAt: c3CyanDone.completedAt,
          timeTakenMs: c3CyanDone.timeTakenMs,
        },
        {
          teamName: "Magenta",
          members: [users[4]._id, users[0]._id],
          totalSquats: 4, totalPushups: 3,
          startedWorkoutAt: c3MagentaStart,
          completedAt: null, timeTakenMs: null,
        },
      ]
    });

    await challenge1.save();
    await challenge2.save();
    await challenge3.save();

    console.log("\\nReseeded Challenges successfully! Team Red is fresh and ready for testing.");
    process.exit();
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
};

reseed();
