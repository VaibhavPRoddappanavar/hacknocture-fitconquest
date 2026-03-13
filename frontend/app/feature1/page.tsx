"use client";

import dynamic from "next/dynamic";
import LeaderboardPanel from "./components/LeaderboardPanel";
import "./feature1.css";

// Leaflet requires `window` — dynamic import with SSR disabled
const MapView = dynamic(() => import("./components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="map-loading">
      <div className="map-loading-spinner" />
      <span>Loading map…</span>
    </div>
  ),
});

export default function Feature1() {
  return (
    <div className="feature1-container" id="feature-1-page">
      {/* Left — Interactive Map (70%) */}
      <MapView />

      {/* Right — Leaderboard Panel (30%) */}
      <LeaderboardPanel />
    </div>
  );
}
