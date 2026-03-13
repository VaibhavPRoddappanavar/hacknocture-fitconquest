"use client";

import Link from "next/link";
import LeaderboardPanel from "../components/LeaderboardPanel";
import "../feature1.css";

export default function Feature1LeaderboardPage() {
  return (
    <main className="feature1-leaderboard-page">
      <div className="feature1-leaderboard-nav">
        <Link href="/feature1" className="feature1-back-link">
          ← Back to Map
        </Link>
      </div>
      <LeaderboardPanel />
    </main>
  );
}
