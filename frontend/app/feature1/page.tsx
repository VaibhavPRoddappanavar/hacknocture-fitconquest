"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

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

  if (!user) {
    return (
      <div className="feature-page feature-1-page" id="feature-1-page" style={{ minHeight: '80vh', padding: '10rem 2rem' }}>
        <div className="content-card" style={{margin: '0 auto', textAlign: 'center'}}>
           <h2>Login for Workout Tracking</h2>
           <form onSubmit={login} style={{display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem'}}>
             <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" style={{padding: '0.8rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white'}} />
             <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" style={{padding: '0.8rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white'}} />
             <button type="submit" style={{padding: '0.8rem', borderRadius: '8px', background: 'var(--accent-1)', color: 'white', fontWeight: 'bold', cursor: 'pointer'}}>Login</button>
           </form>
           <p style={{marginTop: '1rem', color: '#888', fontSize: '0.9rem'}}>Demo users: vishal, arjun, priya, rahul<br/>Password: password123</p>
        </div>
      </div>
    );
  }

  return (
    <div className="feature-page feature-1-page" id="feature-1-page" style={{ alignItems: 'flex-start', padding: '8rem 5% 4rem' }}>
      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
        <div>
          <Link href="/" className="back-link">
            ← Back to Home
          </Link>
          <div className="page-icon" style={{ marginTop: '1rem' }}>⚡</div>
          <h1>Feature 1</h1>
          <p className="subtitle">
            Welcome, {user.username}! Supercharge your training with intelligent workout tracking, adaptive
            plans, and real-time analytics that evolve with you.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={() => { localStorage.removeItem("fit_token"); setUser(null); }} style={{ padding: '0.75rem 1.5rem', background: 'rgba(255,100,100,0.1)', borderRadius: '12px', color: '#ff8888', border: '1px solid rgba(255,100,100,0.2)', cursor: 'pointer' }}>Logout</button>
        </div>
      </div>

      <div className="content-card" style={{ width: '100%', maxWidth: '800px' }}>
        <h3>What&apos;s Included</h3>
        <ul>
          <li>
            <span className="check">✓</span>
            Real-time workout logging &amp; analytics
          </li>
          <li>
            <span className="check">✓</span>
            AI-powered adaptive training plans
          </li>
          <li>
            <span className="check">✓</span>
            Progress graphs and milestone tracking
          </li>
          <li>
            <span className="check">✓</span>
            Smart recovery recommendations
          </li>
          <li>
            <span className="check">✓</span>
            Integration with wearable devices
          </li>
        </ul>
      </div>
    </div>
  );
}
