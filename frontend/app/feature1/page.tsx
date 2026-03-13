"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
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
  const [user, setUser] = useState<any>(null);
  const [username, setUsername] = useState("vishal");
  const [password, setPassword] = useState("password123");

  useEffect(() => {
    const token = localStorage.getItem("fit_token");
    if (token) {
      fetchUser(token);
    }
  }, []);

  const fetchUser = async (token: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true'
        },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        localStorage.removeItem("fit_token");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true"
        },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("fit_token", data.token);
        setUser(data.user);
      } else {
        alert("Invalid login");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // ── Not logged in: show login form ──────────────────────────────────────────
  if (!user) {
    return (
      <div className="feature-page feature-1-page" id="feature-1-page" style={{ minHeight: '80vh', padding: '10rem 2rem' }}>
        <div className="content-card" style={{ margin: '0 auto', textAlign: 'center' }}>
          <h2>Login for Activity Map</h2>
          <form onSubmit={login} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" style={{ padding: '0.8rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" style={{ padding: '0.8rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
            <button type="submit" style={{ padding: '0.8rem', borderRadius: '8px', background: 'var(--accent-1)', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>Login</button>
          </form>
          <p style={{ marginTop: '1rem', color: '#888', fontSize: '0.9rem' }}>Demo users: vishal, arjun, priya, rahul<br />Password: password123</p>
        </div>
      </div>
    );
  }

  // ── Logged in: full-screen map view ─────────────────────────────────────────
  // Use feature1-container so the CSS height:100vh + flex layout works properly
  return (
    <div className="feature1-container" id="feature-1-page">
      {/* Top bar with user info + logout — sits above the map controls */}
      <div style={{
        position: 'absolute',
        top: 60,
        right: 20,
        zIndex: 1300,
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem'
      }}>
        <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
          👤 {user.username}
        </span>
        <button
          onClick={() => { localStorage.removeItem("fit_token"); setUser(null); }}
          style={{
            padding: '0.5rem 1rem',
            background: 'rgba(255,100,100,0.12)',
            borderRadius: '10px',
            color: '#ff8888',
            border: '1px solid rgba(255,100,100,0.25)',
            cursor: 'pointer',
            fontSize: '0.78rem',
            fontWeight: 700
          }}
        >
          Logout
        </button>
        <Link
          href="/"
          style={{
            padding: '0.5rem 1rem',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '10px',
            color: 'rgba(255,255,255,0.6)',
            border: '1px solid rgba(255,255,255,0.1)',
            textDecoration: 'none',
            fontSize: '0.78rem',
            fontWeight: 700
          }}
        >
          ← Home
        </Link>
      </div>

      <MapView />
    </div>
  );
}
