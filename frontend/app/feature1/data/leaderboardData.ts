export type ActivityMode = "walk" | "cycle";
export type TimeFilter = "daily" | "weekly" | "monthly" | "overall";

export interface LeaderboardUser {
  id: string;
  username: string;
  squats: number;
  challengesWon: number;
  location: string;
  coords: [number, number];
  activity: string;
  mode: ActivityMode;
}

const BASE_USERS: LeaderboardUser[] = [
  {
    id: "1",
    username: "Vikram Singh",
    squats: 2450,
    challengesWon: 12,
    location: "Cubbon Park",
    coords: [12.9763, 77.5929],
    activity: "Morning Walk • 6.0km",
    mode: "walk",
  },
  {
    id: "2",
    username: "Priya Sharma",
    squats: 1980,
    challengesWon: 9,
    location: "Lalbagh Botanical Garden",
    coords: [12.9507, 77.5848],
    activity: "Fast Walk • 5.1km",
    mode: "walk",
  },
  {
    id: "3",
    username: "Arjun Kumar",
    squats: 1750,
    challengesWon: 7,
    location: "Indiranagar",
    coords: [12.9784, 77.6408],
    activity: "Interval Walk • 4.4km",
    mode: "walk",
  },
  {
    id: "4",
    username: "Meera Reddy",
    squats: 1520,
    challengesWon: 5,
    location: "Koramangala",
    coords: [12.9352, 77.6245],
    activity: "Power Walk • 5.6km",
    mode: "walk",
  },
  {
    id: "5",
    username: "Rahul Verma",
    squats: 1340,
    challengesWon: 4,
    location: "HSR Layout",
    coords: [12.9116, 77.6389],
    activity: "Evening Walk • 4.8km",
    mode: "walk",
  },
  {
    id: "6",
    username: "Sneha Patel",
    squats: 1180,
    challengesWon: 3,
    location: "Jayanagar",
    coords: [12.9299, 77.5838],
    activity: "Cycling • 12km",
    mode: "cycle",
  },
  {
    id: "7",
    username: "Karthik Nair",
    squats: 980,
    challengesWon: 2,
    location: "Whitefield",
    coords: [12.9698, 77.75],
    activity: "Hill Ride • 18km",
    mode: "cycle",
  },
  {
    id: "8",
    username: "Divya Gupta",
    squats: 870,
    challengesWon: 2,
    location: "MG Road",
    coords: [12.9756, 77.607],
    activity: "City Ride • 10km",
    mode: "cycle",
  },
  {
    id: "9",
    username: "Arun Joshi",
    squats: 720,
    challengesWon: 1,
    location: "Malleshwaram",
    coords: [13.0035, 77.5643],
    activity: "Commute Ride • 8km",
    mode: "cycle",
  },
  {
    id: "10",
    username: "Nisha Mehta",
    squats: 650,
    challengesWon: 1,
    location: "Electronic City",
    coords: [12.8399, 77.677],
    activity: "Endurance Ride • 15km",
    mode: "cycle",
  },
];

const PERIOD_MULTIPLIER: Record<TimeFilter, { squats: number; wins: number }> = {
  daily: { squats: 1, wins: 1 },
  weekly: { squats: 6, wins: 3 },
  monthly: { squats: 24, wins: 9 },
  overall: { squats: 100, wins: 36 },
};

export function getLeaderboardUsers(mode: ActivityMode, period: TimeFilter): LeaderboardUser[] {
  const multiplier = PERIOD_MULTIPLIER[period];

  return BASE_USERS.filter((user) => user.mode === mode)
    .map((user) => ({
      ...user,
      squats: Math.round(user.squats * multiplier.squats),
      challengesWon: Math.round(user.challengesWon * multiplier.wins),
    }))
    .sort((a, b) => b.squats - a.squats);
}
