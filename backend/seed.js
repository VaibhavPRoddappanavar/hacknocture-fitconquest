const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const User = require("./models/User");
const Challenge = require("./models/Challenge");

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected for Seeding"))
  .catch((err) => console.error(err));

const seed = async () => {
  try {
    await User.deleteMany({});
    await Challenge.deleteMany({});

    const passwordHash = await bcrypt.hash("password123", 10);

    const usersData = [
      { username: 'vishal', password: passwordHash, flexCoins: 500, location: { city: 'Kochi', state: 'Kerala', country: 'India' } },
      { username: 'arjun', password: passwordHash, flexCoins: 500, location: { city: 'Kochi', state: 'Kerala', country: 'India' } },
      { username: 'priya', password: passwordHash, flexCoins: 500, location: { city: 'Bangalore', state: 'Karnataka', country: 'India' } },
      { username: 'rahul', password: passwordHash, flexCoins: 500, location: { city: 'Bangalore', state: 'Karnataka', country: 'India' } },
      { username: 'testuser', password: passwordHash, flexCoins: 500, location: { city: 'Mumbai', state: 'Maharashtra', country: 'India' } },
    ];

    const users = await User.insertMany(usersData);

    for (let u of users) {
      u.friends = users.filter((x) => x._id !== u._id).map((x) => x._id);
      await u.save();
    }

    const now = new Date();
    const hostUser = users[0];

    // Your team (Red) — you'll play live
    const redMembers = [users[0]._id, users[2]._id]; // vishal, priya

    // ── Fake team helpers ─────────────────────────────────────────────────
    const fakeStart = (minsAgo) => new Date(now.getTime() - minsAgo * 60000);
    const fakeComplete = (startTime, durationMins) => {
      const completedAt = new Date(startTime.getTime() + durationMins * 60000);
      return { completedAt, timeTakenMs: durationMins * 60000 };
    };

    // ═══════════════════════════════════════════════════════════════════════
    // CHALLENGE 1: Squat Sprint (5 squats)
    // ═══════════════════════════════════════════════════════════════════════
    const c1GreenStart = fakeStart(45);
    const c1GreenDone = fakeComplete(c1GreenStart, 15);
    const c1YellowStart = fakeStart(30);

    const challenge1 = new Challenge({
      title: "Squat Sprint 🦵",
      startTime: now,
      endTime: new Date(now.getTime() + 24 * 60 * 60000),
      status: 'active',
      exerciseType: 'squat',
      targetSquats: 5,
      targetPushups: 0,
      host: hostUser._id,
      teams: [
        { teamName: "Red", members: [...redMembers], totalSquats: 0, totalPushups: 0 },
        { teamName: "Blue", members: [users[1]._id, users[3]._id], totalSquats: 0, totalPushups: 0 },
        {
          teamName: "Green",
          members: [users[5]._id, users[6]._id],  // sneha, karthik
          totalSquats: 5, totalPushups: 0,
          startedWorkoutAt: c1GreenStart,
          completedAt: c1GreenDone.completedAt,
          timeTakenMs: c1GreenDone.timeTakenMs,
        },
        {
          teamName: "Yellow",
          members: [users[7]._id, users[8]._id],  // meera, dev
          totalSquats: 3, totalPushups: 0,
          startedWorkoutAt: c1YellowStart,
          completedAt: null, timeTakenMs: null,
        },
      ]
    });

    // ═══════════════════════════════════════════════════════════════════════
    // CHALLENGE 2: Pushup Blitz (5 pushups)
    // ═══════════════════════════════════════════════════════════════════════
    const c2OrangeStart = fakeStart(60);
    const c2OrangeDone = fakeComplete(c2OrangeStart, 12);
    const c2PurpleStart = fakeStart(50);
    const c2PurpleDone = fakeComplete(c2PurpleStart, 18);

    const challenge2 = new Challenge({
      title: "Pushup Blitz 💪",
      startTime: now,
      endTime: new Date(now.getTime() + 24 * 60 * 60000),
      status: 'active',
      exerciseType: 'pushup',
      targetSquats: 0,
      targetPushups: 5,
      host: hostUser._id,
      teams: [
        { teamName: "Red", members: [...redMembers], totalSquats: 0, totalPushups: 0 },
        { teamName: "Blue", members: [users[1]._id, users[3]._id], totalSquats: 0, totalPushups: 0 },
        {
          teamName: "Orange",
          members: [users[5]._id, users[7]._id],  // sneha, meera
          totalSquats: 0, totalPushups: 5,
          startedWorkoutAt: c2OrangeStart,
          completedAt: c2OrangeDone.completedAt,
          timeTakenMs: c2OrangeDone.timeTakenMs,
        },
        {
          teamName: "Purple",
          members: [users[6]._id, users[8]._id],  // karthik, dev
          totalSquats: 0, totalPushups: 5,
          startedWorkoutAt: c2PurpleStart,
          completedAt: c2PurpleDone.completedAt,
          timeTakenMs: c2PurpleDone.timeTakenMs,
        },
        {
          teamName: "Silver",
          members: [users[9]._id],  // ananya
          totalSquats: 0, totalPushups: 2,
          startedWorkoutAt: fakeStart(25),
          completedAt: null, timeTakenMs: null,
        },
      ]
    });

    // ═══════════════════════════════════════════════════════════════════════
    // CHALLENGE 3: Ultimate Combo (5 squats + 5 pushups)
    // ═══════════════════════════════════════════════════════════════════════
    const c3CyanStart = fakeStart(90);
    const c3CyanDone = fakeComplete(c3CyanStart, 20);
    const c3MagentaStart = fakeStart(70);

    const challenge3 = new Challenge({
      title: "Ultimate Combo 🔥",
      startTime: now,
      endTime: new Date(now.getTime() + 24 * 60 * 60000),
      status: 'active',
      exerciseType: 'mixed',
      targetSquats: 5,
      targetPushups: 5,
      host: hostUser._id,
      teams: [
        { teamName: "Red", members: [...redMembers], totalSquats: 0, totalPushups: 0 },
        { teamName: "Blue", members: [users[1]._id, users[3]._id], totalSquats: 0, totalPushups: 0 },
        {
          teamName: "Cyan",
          members: [users[5]._id, users[6]._id],
          totalSquats: 5, totalPushups: 5,
          startedWorkoutAt: c3CyanStart,
          completedAt: c3CyanDone.completedAt,
          timeTakenMs: c3CyanDone.timeTakenMs,
        },
        {
          teamName: "Magenta",
          members: [users[7]._id, users[8]._id],
          totalSquats: 4, totalPushups: 3,
          startedWorkoutAt: c3MagentaStart,
          completedAt: null, timeTakenMs: null,
        },
      ]
    });

    await challenge1.save();
    await challenge2.save();
    await challenge3.save();

    console.log("\nSeeded! All challenges ACTIVE with fake teams.");
    console.log("Login as any user (password: password123)");
    process.exit();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
};

seed();
