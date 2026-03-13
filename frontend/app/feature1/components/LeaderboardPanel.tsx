"use client";

import { useState, useMemo, useEffect } from "react";
import "../feature1.css";

// ============================================================================
// TYPES
// ============================================================================

interface ActivityUser {
  _id: string;
  username: string;
}

interface Activity {
  _id: string;
  userId: ActivityUser;
  activityType: "walk" | "cycle";
  distanceMeters: number;
  durationSeconds: number;
  areaSquareMeters: number;
  startTime: string;
}

type ActivityMode = "walk" | "cycle";
type TimeFilter = "daily" | "weekly" | "monthly" | "overall";
type SortMetric = "area" | "distance" | "time";

interface UserStats {
  id: string;
  username: string;
  totalAreaSqM: number;
  totalDistanceM: number;
  totalDurationSec: number;
  score: number; // dynamically holds the value we are sorting by
}

// ============================================================================
// HELPERS
// ============================================================================

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

function fmtArea(sqm: number): string {
  if (sqm >= 1_000_000) return (sqm / 1_000_000).toFixed(2) + " km²";
  if (sqm > 0) return sqm.toLocaleString("en-IN") + " m²";
  return "0 m²";
}

function fmtDist(m: number): string {
  if (m >= 1000) return (m / 1000).toFixed(1) + " km";
  return Math.round(m) + " m";
}

function fmtDur(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function LeaderboardPanel() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [mode, setMode] = useState<ActivityMode>("walk");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("daily");
  const [sortMetric, setSortMetric] = useState<SortMetric>("area");

  // Fetch activities on mount (fetch last 30 days for enough data)
  useEffect(() => {
    async function fetchAll() {
      try {
        setIsLoading(true);
        const res = await fetch(`${API_URL}/api/activities?days=30&limit=1000`, {
          headers: { "ngrok-skip-browser-warning": "true" },
        });
        if (res.ok) {
          setActivities(await res.json());
        }
      } catch (err) {
        console.error("Failed to fetch activities:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchAll();
  }, []);

  // Compute leaderboard
  const { sortedUsers, maxScore, globalStats } = useMemo(() => {
    if (!activities.length) {
      return { sortedUsers: [], maxScore: 1, globalStats: { users: 0, val: 0 } };
    }

    const now = new Date();
    // Start of today
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Filter activities by time and mode
    const filtered = activities.filter((a) => {
      // 1. Mode filter
      if (a.activityType !== mode) return false;

      // 2. Time filter
      const aDate = new Date(a.startTime);
      const diffDays = (startOfToday.getTime() - aDate.getTime()) / 86400000;

      if (timeFilter === "daily") {
        return diffDays <= 1; // today and yesterday
      } else if (timeFilter === "weekly") {
        return diffDays <= 7;
      } else if (timeFilter === "monthly") {
        return diffDays <= 30;
      }
      return true; // overall
    });

    // Aggregate by user
    const map = new Map<string, UserStats>();

    filtered.forEach((a) => {
      if (!a.userId?._id) return;
      const uid = a.userId._id;
      if (!map.has(uid)) {
        map.set(uid, {
          id: uid,
          username: a.userId.username,
          totalAreaSqM: 0,
          totalDistanceM: 0,
          totalDurationSec: 0,
          score: 0,
        });
      }
      const u = map.get(uid)!;
      u.totalAreaSqM += a.areaSquareMeters || 0;
      u.totalDistanceM += a.distanceMeters || 0;
      u.totalDurationSec += a.durationSeconds || 0;
    });

    // Assign score based on sortMetric
    let maxS = 0;
    let totalVal = 0;

    const users = Array.from(map.values()).map((u) => {
      if (sortMetric === "area") u.score = u.totalAreaSqM;
      else if (sortMetric === "distance") u.score = u.totalDistanceM;
      else if (sortMetric === "time") u.score = u.totalDurationSec;

      if (u.score > maxS) maxS = u.score;
      totalVal += u.score;
      return u;
    });

    // Sort descending by score
    users.sort((a, b) => b.score - a.score);

    return {
      sortedUsers: users,
      maxScore: maxS > 0 ? maxS : 1, // avoid div by 0
      globalStats: { users: users.length, val: totalVal },
    };
  }, [activities, mode, timeFilter, sortMetric]);

  // Format the score currently being displayed
  const formatScore = (val: number, metric: SortMetric) => {
    if (metric === "area") return fmtArea(val);
    if (metric === "distance") return fmtDist(val);
    if (metric === "time") return fmtDur(val);
    return val.toString();
  };

  const getMetricLabel = (metric: SortMetric) => {
    if (metric === "area") return "AREA COVERED";
    if (metric === "distance") return "TOTAL DISTANCE";
    if (metric === "time") return "TIME SPENT";
    return "";
  };

  return (
    <div className="feature1-leaderboard-content-wrapper">
      <div className="lb-header">
        <div className="lb-header-top">
          <h2>🏆 Leaderboard</h2>
          <div className="lb-live-indicator">LIVE</div>
        </div>
        <p>Real-time rankings based on actual user activities</p>
      </div>

      {/* Mode Tabs */}
      <div className="lb-tabs lb-tabs--mode" style={{ marginBottom: "1rem" }}>
        {(["walk", "cycle"] as const).map((activityMode) => (
          <button
            key={activityMode}
            className={`lb-tab ${mode === activityMode ? "lb-tab--active" : ""}`}
            onClick={() => setMode(activityMode)}
            style={{ flex: 1 }}
          >
            {activityMode === "walk" ? "🚶 By Walk" : "🚴 By Cycle"}
          </button>
        ))}
      </div>

      {/* Metric / Category Tabs */}
      <div className="lb-tabs" style={{ marginBottom: "1rem", flexWrap: "wrap", gap: "6px" }}>
        {(["area", "distance", "time"] as const).map((metric) => (
          <button
            key={metric}
            className={`lb-tab ${sortMetric === metric ? "lb-tab--active" : ""}`}
            onClick={() => setSortMetric(metric)}
            style={{ 
              flex: 1, 
              fontSize: "0.8rem", 
              padding: "8px 10px", 
              background: sortMetric === metric ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.03)" 
            }}
          >
            {metric === "area" ? "🗺️ By Region (Area)" : metric === "distance" ? "📏 By Distance" : "⏱️ By Time"}
          </button>
        ))}
      </div>

      {/* Time Filter Tabs */}
      <div className="lb-tabs" style={{ marginBottom: "1.5rem" }}>
        {(["daily", "weekly", "monthly", "overall"] as const).map((tab) => (
          <button
            key={tab}
            className={`lb-tab ${timeFilter === tab ? "lb-tab--active" : ""}`}
            onClick={() => setTimeFilter(tab)}
            style={{ fontSize: "0.8rem", padding: "6px" }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Leaderboard List */}
      <div className="lb-list-wrapper" style={{ minHeight: "400px" }}>
        {isLoading ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", color: "rgba(255,255,255,0.5)" }}>
            Loading activities...
          </div>
        ) : sortedUsers.length === 0 ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", color: "rgba(255,255,255,0.5)" }}>
            No activities found for this filter.
          </div>
        ) : (
          <div className="lb-list">
            {sortedUsers.map((user, idx) => {
              const rank = idx + 1;
              const progress = (user.score / maxScore) * 100;
              return (
                <div
                  key={user.id}
                  className={`lb-row ${rank === 1 ? "lb-row--gold" : rank === 2 ? "lb-row--silver" : rank === 3 ? "lb-row--bronze" : ""}`}
                >
                  <div className={`lb-rank lb-rank--${rank}`}>
                    {rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : rank}
                  </div>

                  <div className="lb-info">
                    <div className="lb-username">{user.username}</div>
                    
                    {/* Small sub-stats display */}
                    <div style={{ display: "flex", gap: "10px", marginTop: "4px", fontSize: "0.65rem", color: "rgba(255,255,255,0.4)" }}>
                      {sortMetric !== "area" && <span>🗺️ {fmtArea(user.totalAreaSqM)}</span>}
                      {sortMetric !== "distance" && <span>📏 {fmtDist(user.totalDistanceM)}</span>}
                      {sortMetric !== "time" && <span>⏱️ {fmtDur(user.totalDurationSec)}</span>}
                    </div>
                  </div>

                  <div className="lb-squats" style={{ textAlign: "right", zIndex: 2 }}>
                    <div className="lb-squats-value" style={{ fontSize: "1.1rem" }}>
                      {formatScore(user.score, sortMetric)}
                    </div>
                    <div className="lb-squats-label" style={{ opacity: 0.8 }}>
                      {getMetricLabel(sortMetric)}
                    </div>
                  </div>

                  <div className="lb-progress" style={{ width: `${progress}%`, transition: "width 0.5s ease" }} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Summary Footer */}
      <div className="lb-footer">
        <div className="lb-footer-card">
          <div className="lb-stat">
            <div className="lb-stat-label">Active Users</div>
            <div className="lb-stat-value">{globalStats.users}</div>
          </div>
          <div className="lb-stat" style={{ textAlign: "right" }}>
            <div className="lb-stat-label">Total {getMetricLabel(sortMetric)}</div>
            <div className="lb-stat-value lb-stat-value--accent">
              {formatScore(globalStats.val, sortMetric)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
