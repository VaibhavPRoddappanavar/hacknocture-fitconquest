"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  stats?: {
    totalPushups?: number;
    totalSquats?: number;
    exerciseTotals?: {
      pushup?: number;
      squat?: number;
    };
  };
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters <= 0) return "0.0 km";
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatCount(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  return Math.floor(value).toLocaleString("en-IN");
}

async function readJsonSafe(res: Response): Promise<{ data: unknown; text: string }> {
  const text = await res.text();
  try {
    return { data: JSON.parse(text), text };
  } catch {
    return { data: null, text };
  }
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
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "done" | "error">("idle");
  const [syncMessage, setSyncMessage] = useState("Connect Strava to import activities directly from your account.");
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
        setUser({
          _id: resolvedId,
          id: resolvedId,
          username: me?.username || "Athlete",
          stats: me?.stats || undefined,
        });
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
    const runSyncFromOAuthCode = async () => {
      const token = localStorage.getItem("fit_token");
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");
      const error = params.get("error");

      if (!token) return;

      if (error) {
        setSyncState("error");
        setSyncMessage("Strava authorization was cancelled or denied.");
        return;
      }

      if (!code || state !== "fitconquest") return;

      try {
        setSyncState("syncing");
        setSyncMessage("Syncing activities from Strava...");

        const res = await fetch(`${API_URL}/api/activities/strava/sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "ngrok-skip-browser-warning": "true",
          },
          body: JSON.stringify({ code }),
        });

        const { data, text } = await readJsonSafe(res);
        const out = data as { error?: string; imported?: number; skipped?: number } | null;
        if (!res.ok) {
          throw new Error(out?.error || (text.includes("Cannot") ? "Backend route not found. Restart backend server and try again." : "Strava sync failed"));
        }

        setSyncState("done");
        setSyncMessage(`Strava sync complete: ${out.imported ?? 0} imported, ${out.skipped ?? 0} skipped.`);

        const clean = new URL(window.location.href);
        clean.searchParams.delete("code");
        clean.searchParams.delete("state");
        clean.searchParams.delete("scope");
        clean.searchParams.delete("error");
        window.history.replaceState({}, "", clean.toString());

        await loadDashboard();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Strava sync failed";
        setSyncState("error");
        setSyncMessage(message);
      }
    };

    if (typeof window !== "undefined") {
      runSyncFromOAuthCode();
    }
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
    let walkMeters = 0;
    let cycleMeters = 0;

    userActivities.forEach((a) => {
      const dist = Number(a.distanceMeters) || 0;
      if (a.activityType === "cycle") cycleMeters += dist;
      else walkMeters += dist;
    });

    const totalPushups = Number(user?.stats?.totalPushups ?? user?.stats?.exerciseTotals?.pushup ?? 0) || 0;
    const totalSquats = Number(user?.stats?.totalSquats ?? user?.stats?.exerciseTotals?.squat ?? 0) || 0;

    return {
      walkMeters,
      cycleMeters,
      totalPushups,
      totalSquats,
    };
  }, [userActivities, user]);

  const handleStravaConnect = async () => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("fit_token") : null;
      if (!token) {
        setSyncState("error");
        setSyncMessage("Please login first to connect Strava.");
        return;
      }

      const candidates = [
        `${API_URL}/api/activities/strava/connect-url?state=fitconquest`,
        `${API_URL}/api/activities/strava/connect?state=fitconquest`,
      ];

      let out: { url?: string } | null = null;
      let lastError = "Unable to start Strava connection";

      for (const url of candidates) {
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            "ngrok-skip-browser-warning": "true",
          },
        });

        const parsed = await readJsonSafe(res);
        const parsedData = parsed.data as { url?: string; error?: string } | null;

        if (res.ok && parsedData?.url) {
          out = parsedData;
          break;
        }

        lastError = parsedData?.error || (parsed.text.includes("Cannot") ? "Strava route missing on backend. Restart backend server." : lastError);
      }

      if (!out?.url) {
        throw new Error(lastError);
      }

      window.location.href = out.url;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to connect Strava";
      setSyncState("error");
      setSyncMessage(message);
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
        setSyncState("error");
        setSyncMessage("Invalid login. Try demo users with password123.");
        return;
      }

      const data = await res.json();
      localStorage.setItem("fit_token", data.token);
      setSyncState("idle");
      setSyncMessage("Connect Strava to import activities directly from your account.");
      await loadDashboard();
    } catch (err) {
      console.error("Login failed", err);
      setSyncState("error");
      setSyncMessage("Login failed. Please try again.");
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
            <div style={{ padding: "0.65rem 0.85rem", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <button
                type="button"
                onClick={handleStravaConnect}
                style={{ width: "100%", textAlign: "left", padding: "0.55rem 0.7rem", borderRadius: 8, border: "1px solid rgba(255,185,122,0.45)", background: "linear-gradient(135deg, #ff7d3a, #ff914d)", color: "#111", fontWeight: 800, cursor: "pointer" }}
              >
                Connect Strava
              </button>
              <p style={{ marginTop: "0.45rem", fontSize: "0.72rem", color: syncState === "error" ? "#ffb4b4" : syncState === "done" ? "#91ffc4" : "rgba(255,255,255,0.62)", lineHeight: 1.35 }}>
                {syncMessage}
              </p>
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
            <p>Walk Overall</p>
            <h3>{loading ? "..." : formatDistance(stats.walkMeters)}</h3>
            <span>Total walk distance</span>
          </article>
          <article className="metric-card" style={{ background: "linear-gradient(160deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))", border: "1px solid var(--card-border)", borderRadius: 18, padding: "1rem 1.1rem", minHeight: 128 }}>
            <p>Cycle Overall</p>
            <h3>{loading ? "..." : formatDistance(stats.cycleMeters)}</h3>
            <span>Total cycle distance</span>
          </article>
          <article className="metric-card" style={{ background: "linear-gradient(160deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))", border: "1px solid var(--card-border)", borderRadius: 18, padding: "1rem 1.1rem", minHeight: 128 }}>
            <p>Pushups Overall</p>
            <h3>{loading ? "..." : formatCount(stats.totalPushups)}</h3>
            <span>Total pushup reps</span>
          </article>
          <article className="metric-card metric-card--overall" style={{ background: "linear-gradient(160deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))", border: "1px solid rgba(6,182,212,0.35)", borderRadius: 18, padding: "1rem 1.1rem", minHeight: 128 }}>
            <p>Squats Overall</p>
            <h3>{loading ? "..." : formatCount(stats.totalSquats)}</h3>
            <span>Total squat reps</span>
          </article>
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
