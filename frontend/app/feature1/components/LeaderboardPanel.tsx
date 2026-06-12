"use client";

import html2canvas from "html2canvas";
import { useState, useMemo, useEffect, useRef } from "react";
import * as turf from "@turf/turf";
// Compute convex hull from route points
function getConvexHull(
  points: Array<{ lat: number; lng: number }>,
): Array<{ lat: number; lng: number }> {
  if (!points || points.length < 3) return [];
  const turfPoints = turf.featureCollection(
    points.map((p) => turf.point([p.lng, p.lat])),
  );
  const hull = turf.convex(turfPoints);
  if (!hull || !hull.geometry || !Array.isArray(hull.geometry.coordinates[0]))
    return [];
  return hull.geometry.coordinates[0].map(([lng, lat]) => ({ lat, lng }));
}
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

interface SharePayload {
  caption: string;
  shareData: {
    userId: string;
    username: string;
    mode: ActivityMode;
    timeFilter: TimeFilter;
    sortMetric: SortMetric;
    rank: number;
    distanceMeters: number;
    distanceKm: number;
    durationSeconds: number;
    durationMinutes: number;
    areaSquareMeters: number;
    areaSquareKm: number;
    mapCenter: { lat: number; lng: number };
    mapBox: {
      minLat: number;
      maxLat: number;
      minLng: number;
      maxLng: number;
    } | null;
    routePoints: Array<{ lat: number; lng: number }>;
    mapImageUrl: string;
    activityCount: number;
  };
}

// ============================================================================
// HELPERS
// ============================================================================

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await response.text();
    throw new Error(
      `Expected JSON but received ${contentType || "unknown"}: ${text.slice(0, 140)}`,
    );
  }
  return response.json();
}

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

function buildRoutePolyline(
  points: Array<{ lat: number; lng: number }>,
  mapBox: SharePayload["shareData"]["mapBox"],
  width: number,
  height: number,
): string {
  if (!points.length) return "";

  const padding = 24;
  const drawableWidth = width - padding * 2;
  const drawableHeight = height - padding * 2;

  let minLat = mapBox?.minLat ?? Infinity;
  let maxLat = mapBox?.maxLat ?? -Infinity;
  let minLng = mapBox?.minLng ?? Infinity;
  let maxLng = mapBox?.maxLng ?? -Infinity;

  if (!mapBox) {
    points.forEach((point) => {
      if (point.lat < minLat) minLat = point.lat;
      if (point.lat > maxLat) maxLat = point.lat;
      if (point.lng < minLng) minLng = point.lng;
      if (point.lng > maxLng) maxLng = point.lng;
    });
  }

  const lngRange = Math.max(maxLng - minLng, 0.00001);
  const latRange = Math.max(maxLat - minLat, 0.00001);

  return points
    .map((point) => {
      const x = padding + ((point.lng - minLng) / lngRange) * drawableWidth;
      const y =
        padding + (1 - (point.lat - minLat) / latRange) * drawableHeight;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function isClosedLoop(
  points: Array<{ lat: number; lng: number }>,
  mapBox: SharePayload["shareData"]["mapBox"],
): boolean {
  if (points.length < 4) return false;

  const first = points[0];
  const last = points[points.length - 1];
  const latRange = Math.max(
    (mapBox?.maxLat ?? first.lat) - (mapBox?.minLat ?? first.lat),
    0.00001,
  );
  const lngRange = Math.max(
    (mapBox?.maxLng ?? first.lng) - (mapBox?.minLng ?? first.lng),
    0.00001,
  );

  const latDiff = Math.abs(first.lat - last.lat) / latRange;
  const lngDiff = Math.abs(first.lng - last.lng) / lngRange;

  return latDiff < 0.08 && lngDiff < 0.08;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function LeaderboardPanel() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [mode, setMode] = useState<ActivityMode>("walk");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("daily");
  const [sortMetric, setSortMetric] = useState<SortMetric>("area");
  const [loggedInUserId, setLoggedInUserId] = useState<string | null>(null);
  const [isShareLoading, setIsShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [sharePayload, setSharePayload] = useState<SharePayload | null>(null);
  const [shareStatus, setShareStatus] = useState<string>("");

  const shareCaptureRef = useRef<HTMLDivElement>(null);

  // Fetch activities on mount (fetch last 30 days for enough data)
  useEffect(() => {
    async function fetchAll() {
      try {
        setIsLoading(true);
        const res = await fetch(
          `${API_URL}/api/activities?days=30&limit=1000`,
          {
            headers: { "ngrok-skip-browser-warning": "true" },
          },
        );
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(
            `Activities request failed (${res.status}): ${errorText.slice(0, 140)}`,
          );
        }
        setActivities(await parseJsonResponse<Activity[]>(res));
      } catch (err) {
        console.error("Failed to fetch activities:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchAll();
  }, []);

  useEffect(() => {
    async function fetchCurrentUser() {
      const token = localStorage.getItem("fit_token");
      if (!token) return;

      try {
        const res = await fetch(`${API_URL}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "ngrok-skip-browser-warning": "true",
          },
        });

        if (!res.ok) return;

        const data: { _id?: string; id?: string } = await res.json();
        const resolvedId =
          typeof data._id === "string"
            ? data._id
            : typeof data.id === "string"
              ? data.id
              : null;
        setCurrentUserId(resolvedId);
      } catch (err) {
        console.error("Failed to resolve current user:", err);
      }
    }

    fetchCurrentUser();
  }, []);

  // Compute leaderboard
  const { sortedUsers, maxScore, globalStats } = useMemo(() => {
    if (!activities.length) {
      return {
        sortedUsers: [],
        maxScore: 1,
        globalStats: { users: 0, val: 0 },
      };
    }

    const now = new Date();
    // Start of today
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

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

  // Use currentUserId for Instagram post logic to match backend
  const loggedInUserStats = useMemo(() => {
    if (!currentUserId) return null;
    return sortedUsers.find((user) => user.id === currentUserId) || null;
  }, [currentUserId, sortedUsers]);

  const topThreeUsers = useMemo(() => sortedUsers.slice(0, 3), [sortedUsers]);

  async function handlePostOnInstagram() {
    setShareError(null);
    setShareStatus("");

    const token = window.localStorage.getItem("fit_token");
    if (!token) {
      setShareError("Login required. Please login in Feature 2 first.");
      return;
    }

    if (!loggedInUserStats) {
      setShareError("Logged-in user not found in this leaderboard filter.");
      return;
    }

    try {
      setIsShareLoading(true);

      const res = await fetch(`${API_URL}/api/share/instagram-caption`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ mode, timeFilter, sortMetric }),
      });

      let json: SharePayload | { error?: string };
      try {
        json = await parseJsonResponse<SharePayload | { error?: string }>(res);
      } catch (parseErr) {
        const message =
          parseErr instanceof Error
            ? parseErr.message
            : "Invalid server response";
        throw new Error(message);
      }

      if (!res.ok) {
        const message =
          "error" in json && json.error
            ? json.error
            : "Failed to generate Instagram content";
        throw new Error(message);
      }

      setSharePayload(json as SharePayload);

      await new Promise((resolve) => setTimeout(resolve, 150));

      if (!shareCaptureRef.current) {
        throw new Error("Share preview element not ready");
      }

      const canvas = await html2canvas(shareCaptureRef.current, {
        backgroundColor: "#070910",
        scale: 2,
        useCORS: true,
      });

      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/png", 1),
      );
      if (!blob) {
        throw new Error("Failed to export screenshot");
      }

      const imageUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = imageUrl;
      anchor.download = `fitconquest-${mode}-${timeFilter}-${Date.now()}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(imageUrl);

      try {
        await navigator.clipboard.writeText((json as SharePayload).caption);
      } catch {
        // ignore clipboard failure
      }

      window.open(
        "https://www.instagram.com/",
        "_blank",
        "noopener,noreferrer",
      );
      setShareStatus(
        "Screenshot downloaded and caption copied. Paste it in Instagram post/caption.",
      );
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to create Instagram content";
      setShareError(message);
    } finally {
      setIsShareLoading(false);
    }
  }

  return (
    <div className="feature1-leaderboard-content-wrapper">
      <div className="lb-header">
        <div className="lb-header-top">
          <h2>Leaderboard</h2>
          <div className="lb-live-indicator">LIVE</div>
        </div>
        <p>Real-time rankings based on actual user activities</p>
        <div className="lb-share-actions">
          <button
            className="lb-share-btn"
            onClick={handlePostOnInstagram}
            disabled={isShareLoading}
          >
            {isShareLoading ? "Generating post..." : "Post on Instagram"}
          </button>
          {shareError && <span className="lb-share-error">{shareError}</span>}
          {!shareError && shareStatus && (
            <span className="lb-share-success">{shareStatus}</span>
          )}
        </div>
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
            {activityMode === "walk" ? "By Walk" : "By Cycle"}
          </button>
        ))}
      </div>

      {/* Metric / Category Tabs */}
      <div
        className="lb-tabs"
        style={{ marginBottom: "1rem", flexWrap: "wrap", gap: "6px" }}
      >
        {(["area", "distance", "time"] as const).map((metric) => (
          <button
            key={metric}
            className={`lb-tab ${sortMetric === metric ? "lb-tab--active" : ""}`}
            onClick={() => setSortMetric(metric)}
            style={{
              flex: 1,
              fontSize: "0.8rem",
              padding: "8px 10px",
              background:
                sortMetric === metric
                  ? "rgba(255,255,255,0.15)"
                  : "rgba(255,255,255,0.03)",
            }}
          >
            {metric === "area"
              ? "By Region (Area)"
              : metric === "distance"
                ? "By Distance"
                : "By Time"}
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
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "100%",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            Loading activities...
          </div>
        ) : sortedUsers.length === 0 ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "100%",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            No activities found for this filter.
          </div>
        ) : (
          <div className="lb-list">
            {sortedUsers.map((user, idx) => {
              const rank = idx + 1;
              const progress = (user.score / maxScore) * 100;
              const isCurrentUser =
                !!currentUserId && user.id === currentUserId;
              return (
                <div
                  key={user.id}
                  className={`lb-row ${rank === 1 ? "lb-row--gold" : rank === 2 ? "lb-row--silver" : rank === 3 ? "lb-row--bronze" : ""}`}
                  style={
                    isCurrentUser
                      ? {
                          border: "1px solid rgba(74, 222, 128, 0.75)",
                          boxShadow: "0 0 0 2px rgba(74, 222, 128, 0.22) inset",
                          background: "rgba(74, 222, 128, 0.08)",
                        }
                      : undefined
                  }
                >
                  <div className={`lb-rank lb-rank--${rank}`}>{rank}</div>

                  <div className="lb-info">
                    <div
                      className="lb-username"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <span>{user.username}</span>
                      {isCurrentUser && (
                        <span
                          style={{
                            fontSize: "0.62rem",
                            fontWeight: 800,
                            letterSpacing: "0.05em",
                            color: "#0a1f0f",
                            background: "#4ade80",
                            borderRadius: "999px",
                            padding: "2px 8px",
                          }}
                        >
                          YOU
                        </span>
                      )}
                    </div>

                    {/* Small sub-stats display */}
                    <div
                      style={{
                        display: "flex",
                        gap: "10px",
                        marginTop: "4px",
                        fontSize: "0.65rem",
                        color: "rgba(255,255,255,0.4)",
                      }}
                    >
                      {sortMetric !== "area" && (
                        <span>Area {fmtArea(user.totalAreaSqM)}</span>
                      )}
                      {sortMetric !== "distance" && (
                        <span>Distance {fmtDist(user.totalDistanceM)}</span>
                      )}
                      {sortMetric !== "time" && (
                        <span>Time {fmtDur(user.totalDurationSec)}</span>
                      )}
                    </div>
                  </div>

                  <div
                    className="lb-squats"
                    style={{ textAlign: "right", zIndex: 2 }}
                  >
                    <div
                      className="lb-squats-value"
                      style={{ fontSize: "1.1rem" }}
                    >
                      {formatScore(user.score, sortMetric)}
                    </div>
                    <div className="lb-squats-label" style={{ opacity: 0.8 }}>
                      {getMetricLabel(sortMetric)}
                    </div>
                  </div>

                  <div
                    className="lb-progress"
                    style={{
                      width: `${progress}%`,
                      transition: "width 0.5s ease",
                    }}
                  />
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
            <div className="lb-stat-label">
              Total {getMetricLabel(sortMetric)}
            </div>
            <div className="lb-stat-value lb-stat-value--accent">
              {formatScore(globalStats.val, sortMetric)}
            </div>
          </div>
        </div>
      </div>

      {sharePayload && (
        <div className="ig-share-preview-block">
          <h3 style={{ marginBottom: 8 }}>Instagram Share Preview</h3>
          <div
            style={{
              background: "#23263a",
              borderRadius: 14,
              padding: "1.3rem 1.2rem",
              margin: "1rem 0 1.5rem",
              color: "#fff",
              fontSize: "1.13rem",
              fontWeight: 600,
              boxShadow: "0 2px 12px #0003",
              border: "1.5px solid #3b3f5c",
              maxWidth: 700,
              wordBreak: "break-word",
              lineHeight: 1.6,
              letterSpacing: 0.01,
              textShadow: "0 1px 2px #0006",
              cursor: "pointer",
              userSelect: "all",
            }}
            title="Click to copy caption"
            onClick={() => {
              if (sharePayload.caption) {
                navigator.clipboard.writeText(sharePayload.caption);
              }
            }}
          >
            {sharePayload.caption || (
              <span style={{ color: "#f87171" }}>No caption generated.</span>
            )}
            <span
              style={{
                display: "block",
                fontSize: "0.95em",
                color: "#38bdf8",
                marginTop: 8,
                fontWeight: 400,
              }}
            >
              Click to copy caption for Instagram
            </span>
          </div>
        </div>
      )}

      <div className="ig-share-capture-root" aria-hidden="true">
        {sharePayload && (
          <div ref={shareCaptureRef} className="ig-share-card">
            <div className="ig-share-head">
              <span>FitConquest Daily Map</span>
              <strong>@{sharePayload.shareData.username}</strong>
            </div>

            <div className="ig-share-map-img ig-share-map-canvas">
              <img
                src={`${API_URL}/api/share/static-map?lat=${sharePayload.shareData.mapCenter.lat}&lng=${sharePayload.shareData.mapCenter.lng}&zoom=12&width=1012&height=380`}
                alt="Map background"
                className="ig-share-map-bg"
                crossOrigin="anonymous"
              />

              {sharePayload.shareData.routePoints?.length > 1 ? (
                <svg
                  className="ig-share-route-svg"
                  viewBox="0 0 1012 380"
                  preserveAspectRatio="none"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                  }}
                >
                  <defs>
                    <linearGradient id="ig-route" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#22d3ee" />
                      <stop offset="50%" stopColor="#818cf8" />
                      <stop offset="100%" stopColor="#c084fc" />
                    </linearGradient>
                  </defs>

                  {/* Convex hull polygon overlay (styled like provided image) */}
                  {(() => {
                    // For demo: support multiple hulls if needed (future-proofing)
                    // For now, only one hull from routePoints
                    const hulls = [];
                    const mainHull = getConvexHull(
                      sharePayload.shareData.routePoints,
                    );
                    if (mainHull.length > 2) hulls.push(mainHull);

                    // Color palette for hulls
                    const hullColors = [
                      "rgba(34,197,94,0.18)", // green
                      "rgba(59,130,246,0.18)", // blue
                      "rgba(244,63,94,0.18)", // red
                      "rgba(251,191,36,0.18)", // yellow
                      "rgba(139,92,246,0.18)", // purple
                      "rgba(16,185,129,0.18)", // teal
                      "rgba(236,72,153,0.18)", // pink
                    ];

                    if (hulls.length > 0) {
                      return hulls.map((hull, idx) => {
                        const hullPoints = buildRoutePolyline(
                          hull,
                          sharePayload.shareData.mapBox,
                          1012,
                          380,
                        );
                        return (
                          <polygon
                            key={idx}
                            points={hullPoints}
                            fill={hullColors[idx % hullColors.length]}
                            stroke="#22223b"
                            strokeWidth="4"
                            style={{
                              filter: "drop-shadow(0 2px 8px #22223b44)",
                            }}
                          />
                        );
                      });
                    }
                    return (
                      <text
                        x="50%"
                        y="50%"
                        textAnchor="middle"
                        fill="#f87171"
                        fontSize="22"
                        fontWeight="bold"
                      >
                        No hull
                      </text>
                    );
                  })()}

                  {/* Route polyline */}
                  <polyline
                    points={buildRoutePolyline(
                      sharePayload.shareData.routePoints,
                      sharePayload.shareData.mapBox,
                      1012,
                      380,
                    )}
                    fill="none"
                    stroke="url(#ig-route)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.95"
                  />
                </svg>
              ) : (
                <div className="ig-share-map-fallback">
                  No route geometry available for map preview
                </div>
              )}
            </div>

            <div className="ig-share-metrics-grid">
              <div>
                <span>Distance</span>
                <strong>
                  {fmtDist(sharePayload.shareData.distanceMeters)}
                </strong>
              </div>
              <div>
                <span>Time</span>
                <strong>
                  {fmtDur(sharePayload.shareData.durationSeconds)}
                </strong>
              </div>
              <div>
                <span>Area</span>
                <strong>
                  {fmtArea(sharePayload.shareData.areaSquareMeters)}
                </strong>
              </div>
              <div>
                <span>Rank</span>
                <strong>#{sharePayload.shareData.rank}</strong>
              </div>
            </div>

            <div className="ig-share-map-box">
              <span>Map Box</span>
              {sharePayload.shareData.mapBox ? (
                <p>
                  lat [{sharePayload.shareData.mapBox.minLat.toFixed(4)},{" "}
                  {sharePayload.shareData.mapBox.maxLat.toFixed(4)}] • lng [
                  {sharePayload.shareData.mapBox.minLng.toFixed(4)},{" "}
                  {sharePayload.shareData.mapBox.maxLng.toFixed(4)}]
                </p>
              ) : (
                <p>No detailed route bounds available</p>
              )}
            </div>

            <div className="ig-share-leaderboard-mini">
              <h4>Leaderboard Snapshot</h4>
              {topThreeUsers.map((entry, index) => (
                <div key={entry.id} className="ig-share-leaderboard-row">
                  <span>
                    #{index + 1} {entry.username}
                  </span>
                  <strong>{formatScore(entry.score, sortMetric)}</strong>
                </div>
              ))}
              {loggedInUserStats && (
                <div className="ig-share-leaderboard-row ig-share-leaderboard-row--you">
                  <span>You: {loggedInUserStats.username}</span>
                  <strong>
                    {formatScore(loggedInUserStats.score, sortMetric)}
                  </strong>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
