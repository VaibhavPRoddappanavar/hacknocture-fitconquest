"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function Leaderboard() {
  const [challenges, setChallenges] = useState<any[]>([]);
  const [selectedChallenge, setSelectedChallenge] = useState<string | null>(null);
  const [challengeLeaderboard, setChallengeLeaderboard] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [view, setView] = useState<"challenges" | "global">("challenges");

  useEffect(() => {
    fetchChallenges();
    fetchGlobalLeaderboard();
  }, []);

  useEffect(() => {
    if (selectedChallenge) fetchChallengeLeaderboard(selectedChallenge);
  }, [selectedChallenge]);

  const fetchChallenges = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/leaderboard/challenges`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      if (res.ok) setChallenges(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchChallengeLeaderboard = async (id: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/leaderboard/challenge/${id}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      if (res.ok) setChallengeLeaderboard(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchGlobalLeaderboard = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/leaderboard`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      if (res.ok) setUsers(await res.json());
    } catch (e) { console.error(e); }
  };

  const getExerciseIcon = (type: string) => {
    if (type === 'squat') return '🦵';
    if (type === 'pushup') return '💪';
    return '🔥';
  };

  const getStatusColor = (status: string) => {
    if (status === 'active') return '#4ade80';
    if (status === 'completed') return '#818cf8';
    return '#fde047';
  };

  const getTeamColor = (name: string) => name === 'Red' ? '#ff8888' : '#88ccff';
  const getTeamBg = (name: string) => name === 'Red' ? 'rgba(255,100,100,0.08)' : 'rgba(100,200,255,0.08)';

  return (
    <div className="feature-page" style={{ padding: '8rem 5% 4rem', alignItems: 'flex-start' }}>
      <Link href="/feature2" className="back-link" style={{marginBottom: '2rem'}}>← Back to Squads</Link>

      <div style={{ width: '100%', textAlign: 'center', marginBottom: '3rem' }}>
        <div className="page-icon" style={{margin: '0 auto 1.5rem'}}>🏆</div>
        <h1>Leaderboards</h1>
        <p className="subtitle" style={{margin: '0 auto'}}>Team rankings across all challenges</p>
      </div>

      {/* View Toggle */}
      <div style={{ display: 'flex', gap: '0.5rem', margin: '0 auto 3rem', background: 'var(--card-bg)', padding: '0.4rem', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
        <button
          onClick={() => { setView("challenges"); setSelectedChallenge(null); setChallengeLeaderboard(null); }}
          style={{
            padding: '0.7rem 1.5rem', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem',
            background: view === 'challenges' ? 'var(--accent-1)' : 'transparent',
            color: view === 'challenges' ? '#fff' : '#aaa',
            transition: 'all 0.2s ease',
          }}
        >
          📊 Challenge Leaderboards
        </button>
        <button
          onClick={() => setView("global")}
          style={{
            padding: '0.7rem 1.5rem', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem',
            background: view === 'global' ? 'var(--accent-1)' : 'transparent',
            color: view === 'global' ? '#fff' : '#aaa',
            transition: 'all 0.2s ease',
          }}
        >
          🌍 Global Leaderboard
        </button>
      </div>

      {/* Challenge Leaderboards */}
      {view === 'challenges' && !selectedChallenge && (
        <div style={{ width: '100%', maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {challenges.map(c => (
            <div
              key={c._id}
              onClick={() => setSelectedChallenge(c._id)}
              style={{
                background: 'var(--card-bg)', border: '1px solid var(--card-border)',
                borderRadius: '20px', padding: '2rem', cursor: 'pointer',
                transition: 'transform 0.2s, border-color 0.2s',
              }}
              onMouseEnter={(e: any) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
              onMouseLeave={(e: any) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'var(--card-border)'; }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ fontSize: '2rem' }}>{getExerciseIcon(c.exerciseType)}</span>
                  <div>
                    <h3 style={{ fontSize: '1.3rem', margin: 0 }}>{c.title}</h3>
                    <span style={{ fontSize: '0.8rem', color: '#888' }}>
                      {c.exerciseType === 'squat' && `${c.targetSquats} Squats`}
                      {c.exerciseType === 'pushup' && `${c.targetPushups} Pushups`}
                      {c.exerciseType === 'mixed' && `${c.targetSquats} Squats + ${c.targetPushups} Pushups`}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{
                    padding: '0.3rem 0.8rem', borderRadius: '20px', fontSize: '0.75rem',
                    fontWeight: 'bold', textTransform: 'uppercase',
                    background: `${getStatusColor(c.status)}22`,
                    color: getStatusColor(c.status),
                  }}>
                    {c.status}
                  </span>
                  <span style={{ color: '#555', fontSize: '1.2rem' }}>→</span>
                </div>
              </div>

              {/* Quick team scores */}
              <div style={{ display: 'flex', gap: '1rem' }}>
                {c.teams.map((t: any) => (
                  <div key={t.teamName} style={{
                    flex: 1, padding: '0.75rem 1rem', borderRadius: '12px',
                    background: getTeamBg(t.teamName), border: `1px solid ${getTeamColor(t.teamName)}22`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: getTeamColor(t.teamName), fontWeight: 'bold', fontSize: '0.9rem' }}>
                        Team {t.teamName}
                      </span>
                      <div style={{ textAlign: 'right' }}>
                        {(c.exerciseType === 'squat' || c.exerciseType === 'mixed') &&
                          <div style={{ fontSize: '0.8rem', color: '#aaa' }}>🦵 {t.totalSquats}/{c.targetSquats}</div>
                        }
                        {(c.exerciseType === 'pushup' || c.exerciseType === 'mixed') &&
                          <div style={{ fontSize: '0.8rem', color: '#aaa' }}>💪 {t.totalPushups}/{c.targetPushups}</div>
                        }
                      </div>
                    </div>
                    {t.completed && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#4ade80', fontWeight: 'bold' }}>
                        ✅ Completed {t.timeTakenFormatted ? `in ${t.timeTakenFormatted}` : ''}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {c.winnerTeam && (
                <div style={{ marginTop: '1rem', textAlign: 'center', padding: '0.5rem', borderRadius: '8px', background: 'rgba(99,102,241,0.1)', color: 'var(--accent-1)', fontWeight: 'bold', fontSize: '0.9rem' }}>
                  🏆 Winner: Team {c.winnerTeam}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Selected Challenge Detail */}
      {view === 'challenges' && selectedChallenge && challengeLeaderboard && (
        <div style={{ width: '100%', maxWidth: '900px', margin: '0 auto' }}>
          <button
            onClick={() => { setSelectedChallenge(null); setChallengeLeaderboard(null); }}
            style={{
              padding: '0.5rem 1rem', borderRadius: '8px', background: 'rgba(255,255,255,0.06)',
              color: '#aaa', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', marginBottom: '2rem', fontSize: '0.85rem',
            }}
          >
            ← All Challenges
          </button>

          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <span style={{ fontSize: '2.5rem' }}>{getExerciseIcon(challengeLeaderboard.exerciseType)}</span>
            <h2 style={{ fontSize: '2rem', margin: '0.5rem 0' }}>{challengeLeaderboard.title}</h2>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              {(challengeLeaderboard.exerciseType === 'squat' || challengeLeaderboard.exerciseType === 'mixed') &&
                <span style={{ padding: '0.3rem 0.8rem', borderRadius: '20px', background: 'rgba(99,102,241,0.1)', color: '#818cf8', fontSize: '0.85rem', fontWeight: 'bold' }}>
                  🦵 Target: {challengeLeaderboard.targetSquats} Squats
                </span>
              }
              {(challengeLeaderboard.exerciseType === 'pushup' || challengeLeaderboard.exerciseType === 'mixed') &&
                <span style={{ padding: '0.3rem 0.8rem', borderRadius: '20px', background: 'rgba(6,182,212,0.1)', color: '#22d3ee', fontSize: '0.85rem', fontWeight: 'bold' }}>
                  💪 Target: {challengeLeaderboard.targetPushups} Pushups
                </span>
              }
              <span style={{
                padding: '0.3rem 0.8rem', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold',
                background: `${getStatusColor(challengeLeaderboard.status)}22`,
                color: getStatusColor(challengeLeaderboard.status),
              }}>
                {challengeLeaderboard.status.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Team Ranking Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {challengeLeaderboard.teams.map((team: any, idx: number) => (
              <div key={team.teamName} style={{
                padding: '2rem', borderRadius: '20px',
                background: 'var(--card-bg)', border: `2px solid ${idx === 0 && challengeLeaderboard.winnerTeam ? 'rgba(250,204,21,0.4)' : 'var(--card-border)'}`,
                position: 'relative', overflow: 'hidden',
              }}>
                {/* Rank badge */}
                <div style={{
                  position: 'absolute', top: '1rem', right: '1rem',
                  width: '48px', height: '48px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.3rem', fontWeight: 'bold',
                  background: idx === 0 ? 'linear-gradient(135deg, #fbbf24, #f59e0b)' : 'rgba(255,255,255,0.06)',
                  color: idx === 0 ? '#000' : '#888',
                }}>
                  #{idx + 1}
                </div>

                {/* Winner badge */}
                {team.teamName === challengeLeaderboard.winnerTeam && (
                  <div style={{
                    display: 'inline-block', padding: '0.3rem 1rem', borderRadius: '20px',
                    background: 'linear-gradient(135deg, rgba(250,204,21,0.2), rgba(245,158,11,0.2))',
                    border: '1px solid rgba(250,204,21,0.3)',
                    color: '#fbbf24', fontWeight: 'bold', fontSize: '0.8rem', marginBottom: '1rem',
                  }}>
                    🏆 WINNER
                  </div>
                )}

                <h3 style={{ color: getTeamColor(team.teamName), fontSize: '1.5rem', marginBottom: '1rem' }}>
                  Team {team.teamName}
                </h3>

                {/* Stats grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                  {(challengeLeaderboard.exerciseType === 'squat' || challengeLeaderboard.exerciseType === 'mixed') && (
                    <div style={{ padding: '1rem', borderRadius: '12px', background: 'rgba(99,102,241,0.08)', textAlign: 'center' }}>
                      <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#818cf8' }}>{team.totalSquats}</div>
                      <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>🦵 SQUATS</div>
                    </div>
                  )}
                  {(challengeLeaderboard.exerciseType === 'pushup' || challengeLeaderboard.exerciseType === 'mixed') && (
                    <div style={{ padding: '1rem', borderRadius: '12px', background: 'rgba(6,182,212,0.08)', textAlign: 'center' }}>
                      <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#22d3ee' }}>{team.totalPushups}</div>
                      <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>💪 PUSHUPS</div>
                    </div>
                  )}
                  <div style={{ padding: '1rem', borderRadius: '12px', background: 'rgba(255,255,255,0.04)', textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: team.completed ? '#4ade80' : '#f59e0b' }}>
                      {team.completed ? '✅' : '⏳'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>
                      {team.completed ? 'COMPLETED' : 'IN PROGRESS'}
                    </div>
                  </div>
                  {team.timeTakenFormatted && (
                    <div style={{ padding: '1rem', borderRadius: '12px', background: 'rgba(250,204,21,0.08)', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fbbf24' }}>{team.timeTakenFormatted}</div>
                      <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>⏱ TIME</div>
                    </div>
                  )}
                </div>

                {/* Members */}
                <div style={{ fontSize: '0.85rem', color: '#888' }}>
                  <span style={{ fontWeight: 'bold', color: '#aaa' }}>Members: </span>
                  {team.members.map((m: any) => m.username || 'Unknown').join(', ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Global Leaderboard */}
      {view === 'global' && (
        <div style={{ width: '100%', maxWidth: '800px', margin: '0 auto', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '20px', overflow: 'hidden' }}>
          {users.length === 0 ? (
            <p style={{padding: '3rem', textAlign: 'center', color: '#888'}}>No top performers found yet.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--card-border)' }}>
                  <th style={{ padding: '1.5rem', color: '#aaa', fontWeight: '500' }}>Rank</th>
                  <th style={{ padding: '1.5rem', color: '#aaa', fontWeight: '500' }}>Username</th>
                  <th style={{ padding: '1.5rem', color: '#aaa', fontWeight: '500' }}>Location</th>
                  <th style={{ padding: '1.5rem', color: '#aaa', fontWeight: '500', textAlign: 'right' }}>Total Reps</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={u._id} style={{ borderBottom: '1px solid var(--card-border)', transition: 'background 0.2s' }}
                    onMouseEnter={(e: any) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                    onMouseLeave={(e: any) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '1.5rem', fontWeight: 'bold', color: i < 3 ? 'var(--accent-2)' : '#fff' }}>#{i + 1}</td>
                    <td style={{ padding: '1.5rem', fontWeight: 'bold' }}>@{u.username}</td>
                    <td style={{ padding: '1.5rem', color: '#888', fontSize: '0.9rem' }}>{u.location?.city || '-'}, {u.location?.state || '-'}</td>
                    <td style={{ padding: '1.5rem', fontWeight: 'bold', textAlign: 'right', color: 'var(--accent-1)' }}>{u.stats.totalSquats.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
