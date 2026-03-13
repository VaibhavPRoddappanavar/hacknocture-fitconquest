"use client";

import Link from "next/link";
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type ActivityMode = "walk" | "cycle";

interface Activity {
  _id: string;
  activityType: ActivityMode;
  distanceMeters: number;
  durationSeconds: number;
  startTime: string;
  userId?: string | { _id?: string; username?: string } | null;
}

interface User {
  _id: string;
  id?: string;
  username: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters <= 0) return "0.0 km";
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      cur += '"';
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }

  out.push(cur.trim());
  return out;
}

function parseDurationToSec(value: string): number {
  if (!value) return 0;
  if (/^\d+(\.\d+)?$/.test(value)) return Number(value);
  const parts = value.split(":").map((p) => Number(p));
  if (parts.some((n) => !Number.isFinite(n))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

function parseDistanceToMeters(value: string): number {
  if (!value) return 0;
  const normalized = value.trim().toLowerCase();
  const numeric = Number(normalized.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(numeric)) return 0;
  if (normalized.includes("mi")) return numeric * 1609.34;
  if (normalized.includes("m") && !normalized.includes("km")) return numeric;
  return numeric * 1000;
}

function getActivityUserId(activity: Activity): string | null {
  const value = activity.userId;
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof value._id === "string") return value._id;
  return null;
}

export default function Home() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [username, setUsername] = useState("vishal");
  const [password, setPassword] = useState("password123");
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [importState, setImportState] = useState<"idle" | "importing" | "done" | "error">("idle");
  const [importMessage, setImportMessage] = useState("Upload your Strava CSV to sync runs and rides into FitConquest.");
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const token = typeof window !== "undefined" ? localStorage.getItem("fit_token") : null;
      if (!token) {
        setUser(null);
        setActivities([]);
        setAuthChecked(true);
        return;
      }

      const meRes = await fetch(`${API_URL}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "ngrok-skip-browser-warning": "true",
        },
      });
      if (!meRes.ok) {
        localStorage.removeItem("fit_token");
        setUser(null);
        setActivities([]);
        setAuthChecked(true);
        return;
      }

      const me = await meRes.json();
      const resolvedId = typeof me?._id === "string" ? me._id : typeof me?.id === "string" ? me.id : "";
      if (resolvedId) {
        setUser({ _id: resolvedId, id: resolvedId, username: me?.username || "Athlete" });
      }

      const actRes = await fetch(`${API_URL}/api/activities?days=3650&limit=5000`, {
        headers: { "ngrok-skip-browser-warning": "true" },
      });
      if (actRes.ok) {
        const data = await actRes.json();
        setActivities(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("Dashboard load failed", e);
    } finally {
      setAuthChecked(true);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const onDocClick = (ev: MouseEvent) => {
      if (!profileMenuRef.current) return;
      if (!profileMenuRef.current.contains(ev.target as Node)) {
        setShowProfileMenu(false);
      }
    };

    if (showProfileMenu) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [showProfileMenu]);

  const userActivities = useMemo(() => {
    if (!user?._id) return activities;
    return activities.filter((a) => getActivityUserId(a) === user._id);
  }, [activities, user]);

  const stats = useMemo(() => {
    const now = new Date();
    const nowTs = now.getTime();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const msPerDay = 86400000;
    const startOfWeek = startOfToday - 6 * msPerDay;
    const startOfMonth = startOfToday - 29 * msPerDay;

    const aggregate = {
      today: 0,
      week: 0,
      month: 0,
      overall: 0,
      todayDur: 0,
      monthCount: 0,
    };

    userActivities.forEach((a) => {
      const ts = new Date(a.startTime).getTime();
      if (!Number.isFinite(ts) || ts > nowTs) return;

      const dist = Number(a.distanceMeters) || 0;
      const dur = Number(a.durationSeconds) || 0;

      aggregate.overall += dist;

      if (ts >= startOfToday) {
        aggregate.today += dist;
        aggregate.todayDur += dur;
      }
      if (ts >= startOfWeek) aggregate.week += dist;
      if (ts >= startOfMonth) {
        aggregate.month += dist;
        aggregate.monthCount += 1;
      }
    });

    return aggregate;
  }, [userActivities]);

  const modeStats = useMemo(() => {
    const now = new Date();
    const nowTs = now.getTime();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const msPerDay = 86400000;
    const startOfWeek = startOfToday - 6 * msPerDay;
    const startOfMonth = startOfToday - 29 * msPerDay;

    const base = {
      today: { walk: 0, cycle: 0 },
      week: { walk: 0, cycle: 0 },
      month: { walk: 0, cycle: 0 },
      overall: { walk: 0, cycle: 0 },
    };

    userActivities.forEach((a) => {
      const ts = new Date(a.startTime).getTime();
      if (!Number.isFinite(ts) || ts > nowTs) return;

      const dist = Number(a.distanceMeters) || 0;
      const mode: ActivityMode = a.activityType === "cycle" ? "cycle" : "walk";

      base.overall[mode] += dist;
      if (ts >= startOfToday) base.today[mode] += dist;
      if (ts >= startOfWeek) base.week[mode] += dist;
      if (ts >= startOfMonth) base.month[mode] += dist;
    });

    return base;
  }, [userActivities]);

  const handleStravaImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const token = typeof window !== "undefined" ? localStorage.getItem("fit_token") : null;
    if (!token) {
      setImportState("error");
      setImportMessage("Please login first to import Strava data.");
      return;
    }

    try {
      setImportState("importing");
      setImportMessage("Reading and mapping Strava CSV...");

      const raw = await file.text();
      const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) throw new Error("CSV looks empty.");

      const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
      const idxType = header.findIndex((h) => h.includes("activity type") || h === "type");
      const idxDistance = header.findIndex((h) => h.includes("distance"));
      const idxElapsed = header.findIndex((h) => h.includes("elapsed time") || h.includes("moving time") || h === "duration");
      const idxDate = header.findIndex((h) => h.includes("activity date") || h.includes("start date") || h.includes("date"));

      const parsed = lines.slice(1).map((line) => {
        const cols = parseCsvLine(line);
        const rawType = idxType >= 0 ? (cols[idxType] || "").toLowerCase() : "run";
        const rawDistance = idxDistance >= 0 ? cols[idxDistance] || "" : "0";
        const rawElapsed = idxElapsed >= 0 ? cols[idxElapsed] || "" : "0";
        const rawDate = idxDate >= 0 ? cols[idxDate] || "" : "";

        const activityType: ActivityMode = rawType.includes("ride") || rawType.includes("cycle") ? "cycle" : "walk";
        const distanceMeters = parseDistanceToMeters(rawDistance);
        const durationSeconds = parseDurationToSec(rawElapsed);
        const startTime = rawDate ? new Date(rawDate) : new Date();
        const endTime = new Date(startTime.getTime() + durationSeconds * 1000);

        if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return null;
        if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return null;

        return {
          activityType,
          distanceMeters,
          durationSeconds,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        };
      }).filter(Boolean);

      if (!parsed.length) throw new Error("No valid activities found in CSV.");

      setImportMessage(`Importing ${parsed.length} activities to FitConquest...`);

      const res = await fetch(`${API_URL}/api/activities/import/strava`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({ activities: parsed }),
      });

      const out = await res.json();
      if (!res.ok) throw new Error(out?.error || "Import failed");

      setImportState("done");
      setImportMessage(`Strava sync complete. Imported ${out.imported || parsed.length} activities.`);
      await loadDashboard();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Import failed";
      setImportState("error");
      setImportMessage(message);
    } finally {
      e.target.value = "";
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        setImportState("error");
        setImportMessage("Invalid login. Try demo users with password123.");
        return;
      }

      const data = await res.json();
      localStorage.setItem("fit_token", data.token);
      setImportState("idle");
      setImportMessage("Upload your Strava CSV to sync runs and rides into FitConquest.");
      await loadDashboard();
    } catch (err) {
      console.error("Login failed", err);
      setImportState("error");
      setImportMessage("Login failed. Please try again.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("fit_token");
    setShowProfileMenu(false);
    setUser(null);
    setActivities([]);
    setAuthChecked(true);
  };

  if (!authChecked) {
    return (
      <section className="feature-page" style={{ minHeight: "80vh", padding: "8rem 1.5rem" }}>
        <div className="content-card" style={{ maxWidth: 480, margin: "0 auto", textAlign: "center" }}>
          <h3>Checking session...</h3>
        </div>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="feature-page" style={{ minHeight: "80vh", padding: "8rem 1.5rem" }}>
        <div className="content-card" style={{ maxWidth: 480, margin: "0 auto", textAlign: "center" }}>
          <h3 style={{ marginBottom: "0.65rem" }}>Login to Open Dashboard</h3>
          <p style={{ color: "rgba(255,255,255,0.55)", marginBottom: "1rem" }}>Your home dashboard is now private to your account.</p>
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <input
              type="text"
              value={username}
              onChange={(ev) => setUsername(ev.target.value)}
              placeholder="Username"
              style={{ padding: "0.8rem", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.04)", color: "#fff" }}
            />
            <input
              type="password"
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              placeholder="Password"
              style={{ padding: "0.8rem", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.04)", color: "#fff" }}
            />
            <button type="submit" style={{ padding: "0.8rem", borderRadius: 10, border: "1px solid rgba(99,102,241,0.35)", background: "linear-gradient(135deg, var(--accent-1), #5b4bff)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
              Login
            </button>
          </form>
          <p style={{ marginTop: "0.8rem", fontSize: "0.85rem", color: "rgba(255,255,255,0.45)" }}>
            Demo users: vishal, arjun, priya, rahul. Password: password123
          </p>
        </div>
      </section>
    );
  }

  return (
    <>
      <div ref={profileMenuRef} style={{ position: "fixed", top: 12, right: 16, zIndex: 1200, width: 40, height: 40 }}>
        <button
          type="button"
          onClick={() => setShowProfileMenu((v) => !v)}
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.2)",
            background: "rgba(10,10,16,0.82)",
            color: "#fff",
            fontWeight: 800,
            fontSize: "0.82rem",
            cursor: "pointer",
          }}
          aria-label="Profile menu"
        >
          {(user.username || "U").slice(0, 2).toUpperCase()}
        </button>

        {showProfileMenu && (
          <div style={{ position: "absolute", top: 48, right: 0, minWidth: 180, background: "rgba(12,14,22,0.97)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 12, overflow: "hidden", boxShadow: "0 14px 28px rgba(0,0,0,0.4)" }}>
            <div style={{ padding: "0.7rem 0.85rem", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ fontSize: "0.86rem", color: "#fff", fontWeight: 700 }}>{user.username}</div>
              <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.5)" }}>Signed in</div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              style={{ width: "100%", textAlign: "left", padding: "0.7rem 0.85rem", background: "transparent", border: "none", color: "#ffb4b4", fontWeight: 700, cursor: "pointer" }}
            >
              Logout
            </button>
          </div>
        )}
      </div>

      <section className="home-dash" id="home-dashboard" style={{ position: "relative", zIndex: 1, maxWidth: 1160, margin: "0 auto", padding: "8.5rem 1.5rem 1.5rem" }}>
        <div className="home-dash-header" style={{ display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(0,0.7fr)", gap: "2rem", alignItems: "end", marginBottom: "1.75rem" }}>
          <div>
            <span className="hero-badge">Performance Dashboard</span>
            <h1 style={{ fontSize: "clamp(2rem, 5vw, 3.4rem)", lineHeight: 1.08, letterSpacing: "-0.03em", marginBottom: "0.85rem" }}>
              {user ? `Welcome back, ${user.username}` : "Conquer Your"}
              <br />
              <span className="gradient-text">Daily Momentum</span>
            </h1>
            <p style={{ maxWidth: 620, color: "rgba(255,255,255,0.6)", fontSize: "1rem", lineHeight: 1.7 }}>
              Track your live movement score with day, week, month, and all-time distance in one command center.
            </p>
          </div>
          <div className="home-dash-actions" style={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: "0.8rem" }}>
            <Link href="/feature1" className="home-dash-btn home-dash-btn--primary" style={{ textDecoration: "none", padding: "0.72rem 1.2rem", borderRadius: 12, fontWeight: 700 }}>Open Activity Map</Link>
            <Link href="/feature2" className="home-dash-btn home-dash-btn--primary" style={{ textDecoration: "none", padding: "0.72rem 1.2rem", borderRadius: 12, fontWeight: 700 }}>Open Squad Arena</Link>
          </div>
        </div>

        <div className="home-dash-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: "1rem" }}>
          <article className="metric-card metric-card--today" style={{ background: "linear-gradient(160deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))", border: "1px solid rgba(99,102,241,0.35)", borderRadius: 18, padding: "1rem 1.1rem", minHeight: 128 }}>
            <p>Today</p>
            <h3>{loading ? "..." : formatDistance(stats.today)}</h3>
            <span>{loading ? "" : `${formatDuration(stats.todayDur)} active`}</span>
          </article>
          <article className="metric-card" style={{ background: "linear-gradient(160deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))", border: "1px solid var(--card-border)", borderRadius: 18, padding: "1rem 1.1rem", minHeight: 128 }}>
            <p>Last 7 Days</p>
            <h3>{loading ? "..." : formatDistance(stats.week)}</h3>
            <span>Weekly consistency</span>
          </article>
          <article className="metric-card" style={{ background: "linear-gradient(160deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))", border: "1px solid var(--card-border)", borderRadius: 18, padding: "1rem 1.1rem", minHeight: 128 }}>
            <p>Last 30 Days</p>
            <h3>{loading ? "..." : formatDistance(stats.month)}</h3>
            <span>{loading ? "" : `${stats.monthCount} sessions`}</span>
          </article>
          <article className="metric-card metric-card--overall" style={{ background: "linear-gradient(160deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))", border: "1px solid rgba(6,182,212,0.35)", borderRadius: 18, padding: "1rem 1.1rem", minHeight: 128 }}>
            <p>All Time</p>
            <h3>{loading ? "..." : formatDistance(stats.overall)}</h3>
            <span>Total conquered distance</span>
          </article>
        </div>
      </section>

      <section className="home-side-panels" id="import-and-profile" style={{ position: "relative", zIndex: 1, maxWidth: 1160, margin: "0 auto", padding: "1rem 1.5rem 1.25rem", display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: "1rem" }}>
        <div className="panel-card" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--card-border)", borderRadius: 20, padding: "1.2rem" }}>
          <div className="panel-title-row">
            <h3>Profile Snapshot</h3>
            <span className="panel-tag">Live</span>
          </div>
          <div className="profile-shell">
            <div className="profile-avatar">{user?.username?.slice(0, 2).toUpperCase() || "FC"}</div>
            <div>
              <h4>{user?.username || "Guest Athlete"}</h4>
              <p>{user ? "Token authenticated" : "Login in Feature pages to sync your identity"}</p>
            </div>
          </div>
          <div className="profile-stats-row">
            <div><strong>{formatDistance(stats.overall)}</strong><span>Career</span></div>
            <div><strong>{formatDistance(stats.month)}</strong><span>Month</span></div>
            <div><strong>{formatDistance(stats.today)}</strong><span>Today</span></div>
          </div>
        </div>

        <div className="panel-card panel-card--strava" style={{ background: "radial-gradient(120% 120% at 85% -5%, rgba(255,132,52,0.2) 0%, rgba(255,132,52,0) 60%), rgba(255,255,255,0.04)", border: "1px solid var(--card-border)", borderRadius: 20, padding: "1.2rem" }}>
          <div className="panel-title-row">
            <h3>Import from Strava</h3>
            <span className="panel-tag panel-tag--strava">CSV Sync</span>
          </div>
          <p className="import-copy">
            Upload your Strava exported activities CSV. We map distance, duration, and date, then sync it into your dashboard and map.
          </p>
          <label className="import-dropzone">
            <input type="file" accept=".csv,text/csv" onChange={handleStravaImport} />
            <span>{importState === "importing" ? "Importing..." : "Choose Strava CSV"}</span>
            <small>Expected columns: Activity Type, Distance, Elapsed Time, Activity Date</small>
          </label>
          <p className={`import-status import-status--${importState}`}>{importMessage}</p>
        </div>
      </section>

      <section style={{ position: "relative", zIndex: 1, maxWidth: 1160, margin: "0 auto", padding: "0 1.5rem 2rem" }}>
        <div style={{
          background: "linear-gradient(160deg, rgba(255,255,255,0.055), rgba(255,255,255,0.015))",
          border: "1px solid var(--card-border)",
          borderRadius: 20,
          padding: "1.2rem",
          backdropFilter: "blur(12px)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.85rem", gap: "0.8rem", flexWrap: "wrap" }}>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700, letterSpacing: "-0.01em" }}>Walk vs Cycle Breakdown</h3>
            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.25)", padding: "0.2rem 0.55rem", borderRadius: 999 }}>Distance Split</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: "0.75rem", marginBottom: "0.55rem", color: "rgba(255,255,255,0.55)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
            <span>Window</span>
            <span>Walk</span>
            <span>Cycle</span>
          </div>

          {[
            { key: "today", label: "Today" },
            { key: "week", label: "Last 7 Days" },
            { key: "month", label: "Last 30 Days" },
            { key: "overall", label: "All Time" },
          ].map((row) => {
            const k = row.key as "today" | "week" | "month" | "overall";
            return (
              <div key={row.key} style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: "0.75rem", marginBottom: "0.55rem" }}>
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "0.65rem 0.75rem", fontSize: "0.88rem", color: "rgba(255,255,255,0.9)", fontWeight: 600 }}>{row.label}</div>
                <div style={{ background: "rgba(99,102,241,0.11)", border: "1px solid rgba(99,102,241,0.32)", borderRadius: 12, padding: "0.65rem 0.75rem", fontSize: "0.92rem", color: "#cfd4ff", fontWeight: 700 }}>
                  {loading ? "..." : `🚶 ${formatDistance(modeStats[k].walk)}`}
                </div>
                <div style={{ background: "rgba(6,182,212,0.11)", border: "1px solid rgba(6,182,212,0.32)", borderRadius: 12, padding: "0.65rem 0.75rem", fontSize: "0.92rem", color: "#b4f1ff", fontWeight: 700 }}>
                  {loading ? "..." : `🚴 ${formatDistance(modeStats[k].cycle)}`}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="features-section" id="features">
        <span className="section-label">Explore</span>
        <h2>Core Features</h2>

        <div className="features-grid">
          <Link href="/feature1" className="feature-card" id="feature-1-card">
            <div className="card-icon">⚡</div>
            <h3>Conquest Activity Map</h3>
            <p>Visualize your territory, compare performance against other athletes, and dominate overlap zones in real time.</p>
            <span className="card-arrow">Explore Feature 1 →</span>
          </Link>

          <Link href="/feature2" className="feature-card" id="feature-2-card">
            <div className="card-icon">🎯</div>
            <h3>Squad Challenge Arena</h3>
            <p>Join teams, race on shared goals, and push your limits with live competition and leaderboard pressure.</p>
            <span className="card-arrow">Explore Feature 2 →</span>
          </Link>
        </div>
      </section>
    </>
  );
}
