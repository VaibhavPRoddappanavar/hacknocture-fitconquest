"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function Feature2() {
  const [user, setUser] = useState<any>(null);
  const [username, setUsername] = useState("vishal");
  const [password, setPassword] = useState("password123");
  const [challenges, setChallenges] = useState<any[]>([]);

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
        fetchChallenges();
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
        fetchChallenges();
      } else {
        alert("Invalid login");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchChallenges = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/challenges`, {
        headers: {
          'ngrok-skip-browser-warning': 'true'
        }
      });
      if (res.ok) {
        setChallenges(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const joinTeam = async (challengeId: string, teamName: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/challenges/${challengeId}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("fit_token")}`,
          "ngrok-skip-browser-warning": "true"
        },
        body: JSON.stringify({ userId: user._id || user.id, teamName }),
      });
      if (res.ok) {
        fetchChallenges();
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getExerciseLabel = (c: any) => {
    const type = c.exerciseType || 'squat';
    if (type === 'squat') return `🦵 ${c.targetSquats} Squats`;
    if (type === 'pushup') return `💪 ${c.targetPushups} Pushups`;
    if (type === 'mixed') return `🔥 ${c.targetSquats} Squats + ${c.targetPushups} Pushups`;
    return '';
  };

  const getExerciseBadgeColor = (type: string) => {
    if (type === 'squat') return { bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.3)', color: '#818cf8' };
    if (type === 'pushup') return { bg: 'rgba(6,182,212,0.12)', border: 'rgba(6,182,212,0.3)', color: '#22d3ee' };
    return { bg: 'rgba(251,146,60,0.12)', border: 'rgba(251,146,60,0.3)', color: '#fb923c' };
  };

  if (!user) {
    return (
      <div className="feature-page feature-2-page" id="feature-2-page" style={{ minHeight: '80vh', padding: '10rem 2rem' }}>
        <div className="content-card" style={{ margin: '0 auto', textAlign: 'center' }}>
          <h2>Login to Squad Challenges</h2>
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

  return (
    <div className="feature-page feature-2-page" id="feature-2-page" style={{ alignItems: 'flex-start', padding: '8rem 5% 4rem' }}>
      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
        <div>
          <h1>Squad Challenges</h1>
          <p className="subtitle" style={{ marginTop: '0.5rem' }}>Welcome back, {user.username}! Choose a challenge to start competing.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Link href="/feature2/leaderboard" style={{ padding: '0.75rem 1.5rem', background: 'rgba(255,255,255,0.08)', borderRadius: '12px', color: '#fff', textDecoration: 'none', border: '1px solid rgba(255,255,255,0.1)' }}>🏆 Leaderboard</Link>
          <button onClick={() => { localStorage.removeItem("fit_token"); setUser(null); }} style={{ padding: '0.75rem 1.5rem', background: 'rgba(255,100,100,0.1)', borderRadius: '12px', color: '#ff8888', border: '1px solid rgba(255,100,100,0.2)', cursor: 'pointer' }}>Logout</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '2rem', width: '100%' }}>
        {challenges.map(c => {
          const userId = user._id || user.id;
          const isInRed = c.teams[0].members.find((m: any) => m._id === userId || m === userId);
          const isInBlue = c.teams[1].members.find((m: any) => m._id === userId || m === userId);
          const isParticipant = isInRed || isInBlue;
          const badgeStyle = getExerciseBadgeColor(c.exerciseType || 'squat');

          return (
            <div key={c._id} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '20px', padding: '2rem', position: 'relative', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.4rem' }}>{c.title}</h3>
                <span style={{ padding: '0.3rem 0.8rem', background: c.status === 'active' ? 'rgba(0,255,0,0.1)' : c.status === 'completed' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,0,0.1)', color: c.status === 'active' ? '#4ade80' : c.status === 'completed' ? '#aaa' : '#fde047', borderRadius: '20px', fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 'bold' }}>
                  {c.status}
                </span>
              </div>

              {/* Exercise type badge */}
              <div style={{
                display: 'inline-block',
                padding: '0.3rem 0.8rem',
                borderRadius: '8px',
                background: badgeStyle.bg,
                border: `1px solid ${badgeStyle.border}`,
                color: badgeStyle.color,
                fontSize: '0.85rem',
                fontWeight: 'bold',
                marginBottom: '1.5rem',
              }}>
                {getExerciseLabel(c)}
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                <div style={{ flex: 1, background: 'rgba(255,100,100,0.05)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,100,100,0.1)' }}>
                  <h4 style={{ color: '#ff8888', marginBottom: '0.5rem' }}>Team Red</h4>
                  <p style={{ fontSize: '0.9rem', color: '#aaa' }}>{c.teams[0].members.length} Members</p>
                  {!isParticipant && c.status === 'upcoming' && <button onClick={() => joinTeam(c._id, 'Red')} style={{ marginTop: '0.5rem', background: '#ff8888', color: '#000', border: 'none', padding: '0.3rem 0.6rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>Join Red</button>}
                </div>
                <div style={{ flex: 1, background: 'rgba(100,200,255,0.05)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(100,200,255,0.1)' }}>
                  <h4 style={{ color: '#88ccff', marginBottom: '0.5rem' }}>Team Blue</h4>
                  <p style={{ fontSize: '0.9rem', color: '#aaa' }}>{c.teams[1].members.length} Members</p>
                  {!isParticipant && c.status === 'upcoming' && <button onClick={() => joinTeam(c._id, 'Blue')} style={{ marginTop: '0.5rem', background: '#88ccff', color: '#000', border: 'none', padding: '0.3rem 0.6rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>Join Blue</button>}
                </div>
              </div>

              {isParticipant && (
                <Link href={`/feature2/${c._id}`} style={{ display: 'block', width: '100%', textAlign: 'center', background: 'var(--accent-1)', color: '#fff', textDecoration: 'none', padding: '1rem', borderRadius: '12px', fontWeight: 'bold' }}>
                  Enter Arena
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
