"use client";

import { useEffect, useState, useRef, use } from "react";
import io from "socket.io-client";
import Link from "next/link";

let socket: any;
const AI_ENGINE_URL = "http://localhost:5050";

function formatTime(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return min > 0 ? `${min}m ${sec}s` : `${sec}s`;
}

export default function Arena({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const challengeId = unwrappedParams.id;
  const [challenge, setChallenge] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [activeExercise, setActiveExercise] = useState<"squat" | "pushup">("squat");
  const [aiStats, setAiStats] = useState<any>(null);

  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const prevCountRef = useRef(0);
  const challengeRef = useRef<any>(null);
  const userRef = useRef<any>(null);
  const activeExerciseRef = useRef<"squat" | "pushup">("squat");

  useEffect(() => { challengeRef.current = challenge; }, [challenge]);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { activeExerciseRef.current = activeExercise; }, [activeExercise]);

  useEffect(() => {
    const token = localStorage.getItem("fit_token");
    if (!token) { window.location.href = "/feature2"; return; }
    fetchUser(token);

    socket = io(process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080", {
      extraHeaders: { "ngrok-skip-browser-warning": "true" }
    });
    socket.emit("join_challenge", challengeId);

    socket.on("score_update", (data: any) => {
      setChallenge((prev: any) => prev ? { ...prev, teams: data.teams } : prev);
    });

    return () => {
      if (socket) socket.disconnect();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [challengeId]);

  const fetchUser = async (token: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}`, 'ngrok-skip-browser-warning': 'true' },
      });
      if (res.ok) { const d = await res.json(); setUser(d); userRef.current = d; fetchChallenge(); }
    } catch (e) { console.error(e); }
  };

  const fetchChallenge = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/challenges/${challengeId}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      if (res.ok) {
        const d = await res.json();
        setChallenge(d); challengeRef.current = d;
        const t = d.exerciseType || 'squat';
        if (t === 'pushup') setActiveExercise('pushup');
      }
    } catch (e) { console.error(e); }
  };

  // Find my team
  const getMyTeam = () => {
    const ch = challengeRef.current;
    const u = userRef.current;
    if (!ch || !u) return null;
    const userId = u._id || u.id;
    for (const t of ch.teams) {
      if (t.members.some((m: any) => m._id === userId || m === userId)) return t;
    }
    return null;
  };

  const emitRep = (count: number) => {
    const ch = challengeRef.current;
    const u = userRef.current;
    const ex = activeExerciseRef.current;
    if (!ch || !u) return;
    const myTeam = getMyTeam();
    if (!myTeam) return;
    socket.emit(ex === 'pushup' ? 'pushup_performed' : 'squat_performed', {
      challengeId, teamId: myTeam._id, userId: u._id || u.id, count,
    });
  };

  const startCamera = async (exercise: "squat" | "pushup") => {
    try {
      setActiveExercise(exercise);
      activeExerciseRef.current = exercise;

      // Record team workout start
      const myTeam = getMyTeam();
      if (myTeam && !myTeam.startedWorkoutAt) {
        socket.emit("team_start_workout", { challengeId, teamId: myTeam._id });
      }

      await fetch(`${AI_ENGINE_URL}/exercise`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ exercise }) });
      await fetch(`${AI_ENGINE_URL}/reset`, { method: "POST" });
      setCameraActive(true);
      prevCountRef.current = 0;

      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`${AI_ENGINE_URL}/stats`);
          if (res.ok) {
            const data = await res.json();
            setAiStats(data);
            const newReps = data.count - prevCountRef.current;
            if (newReps > 0) { emitRep(newReps); prevCountRef.current = data.count; }
          }
        } catch (e) { }
      }, 500);
    } catch (e) {
      alert("Could not connect to AI Engine. Run: python app.py");
    }
  };

  const stopCamera = () => {
    setCameraActive(false);
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const switchExercise = (exercise: "squat" | "pushup") => {
    stopCamera();
    setTimeout(() => startCamera(exercise), 300);
  };

  if (!challenge || !user) return <div style={{ padding: '10rem', textAlign: 'center', color: '#aaa' }}>Loading Arena...</div>;

  const exerciseType = challenge.exerciseType || 'squat';

  // Build ranked leaderboard
  const rankedTeams = [...challenge.teams].map((t: any) => {
    const completed =
      exerciseType === 'squat' ? t.totalSquats >= challenge.targetSquats :
        exerciseType === 'pushup' ? t.totalPushups >= challenge.targetPushups :
          t.totalSquats >= challenge.targetSquats && t.totalPushups >= challenge.targetPushups;
    const totalReps = (exerciseType === 'mixed') ? t.totalSquats + t.totalPushups :
      exerciseType === 'squat' ? t.totalSquats : t.totalPushups;
    return { ...t, completed, totalReps };
  }).sort((a: any, b: any) => {
    if (a.completed && b.completed) return (a.timeTakenMs || Infinity) - (b.timeTakenMs || Infinity);
    if (a.completed && !b.completed) return -1;
    if (!a.completed && b.completed) return 1;
    return b.totalReps - a.totalReps;
  });

  const userId = user._id || user.id;
  const myTeam = challenge.teams.find((t: any) =>
    t.members.some((m: any) => m._id === userId || m === userId)
  );
  const myTeamCompleted = myTeam && (
    exerciseType === 'squat' ? myTeam.totalSquats >= challenge.targetSquats :
      exerciseType === 'pushup' ? myTeam.totalPushups >= challenge.targetPushups :
        myTeam.totalSquats >= challenge.targetSquats && myTeam.totalPushups >= challenge.targetPushups
  );

  const teamColors: any = {
    Red: '#ff8888', Blue: '#88ccff', Green: '#4ade80', Yellow: '#fde047',
    Orange: '#fb923c', Purple: '#c084fc', Silver: '#94a3b8', Cyan: '#22d3ee', Magenta: '#f472b6',
  };
  const getColor = (name: string) => teamColors[name] || '#aaa';

  const renderBar = (current: number, target: number, color: string) => {
    if (target <= 0) return null;
    const pct = Math.min((current / target) * 100, 100);
    return (
      <div style={{ width: '100%', height: '8px', background: `${color}22`, borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width 0.3s', borderRadius: '4px' }}></div>
      </div>
    );
  };

  return (
    <div className="feature-page" style={{ padding: '8rem 5% 4rem' }}>
      <Link href="/feature2" className="back-link" style={{ marginBottom: '2rem' }}>← Back to Challenges</Link>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>{challenge.title}</h1>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '0.5rem', flexWrap: 'wrap' }}>
          {(exerciseType === 'squat' || exerciseType === 'mixed') &&
            <span style={{ padding: '0.3rem 0.8rem', borderRadius: '20px', background: 'rgba(99,102,241,0.1)', color: '#818cf8', fontWeight: 'bold', fontSize: '0.85rem' }}>🦵 {challenge.targetSquats} Squats</span>}
          {(exerciseType === 'pushup' || exerciseType === 'mixed') &&
            <span style={{ padding: '0.3rem 0.8rem', borderRadius: '20px', background: 'rgba(6,182,212,0.1)', color: '#22d3ee', fontWeight: 'bold', fontSize: '0.85rem' }}>💪 {challenge.targetPushups} Pushups</span>}
        </div>
        <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#f59e0b' }}>⏰ Challenge ends in 24hrs</p>
      </div>

      {/* Your team's completed banner */}
      {myTeamCompleted && (
        <div style={{ textAlign: 'center', padding: '1rem', borderRadius: '12px', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)', maxWidth: '500px', margin: '0 auto 2rem' }}>
          <p style={{ fontWeight: 'bold', color: '#4ade80', fontSize: '1.1rem' }}>✅ Your team finished!</p>
          {myTeam.timeTakenMs && <p style={{ color: '#aaa', fontSize: '0.85rem', marginTop: '0.25rem' }}>Time: {formatTime(myTeam.timeTakenMs)}</p>}
        </div>
      )}

      {/* Exercise Tracker */}
      {!myTeamCompleted && (
        <div style={{ textAlign: 'center', width: '100%', maxWidth: '900px', margin: '0 auto 3rem' }}>
          <div style={{ padding: '2rem', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '20px' }}>

            {cameraActive ? (
              <div>
                {/* Video */}
                <div style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden', border: '2px solid rgba(99,102,241,0.3)', marginBottom: '1.5rem', background: '#000' }}>
                  <img src={`${AI_ENGINE_URL}/video_feed`} alt="AI Detection" style={{ width: '100%', maxHeight: '480px', objectFit: 'contain', display: 'block' }} />
                  <div style={{ position: 'absolute', top: '12px', left: '12px', padding: '4px 12px', borderRadius: '20px', background: activeExercise === 'squat' ? 'rgba(99,102,241,0.85)' : 'rgba(6,182,212,0.85)', color: '#fff', fontSize: '0.75rem', fontWeight: 'bold' }}>
                    {activeExercise === 'squat' ? '🦵 SQUATS' : '💪 PUSHUPS'}
                  </div>
                  <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '20px', background: 'rgba(255,50,50,0.85)', color: '#fff', fontSize: '0.75rem', fontWeight: 'bold' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fff', animation: 'pulse 1.5s infinite' }}></span>LIVE
                  </div>
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                  <div style={{ padding: '1rem 2rem', borderRadius: '12px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
                    <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--accent-1)' }}>{aiStats?.count || 0}</div>
                    <div style={{ fontSize: '0.8rem', color: '#aaa' }}>{activeExercise === 'squat' ? 'SQUATS' : 'PUSHUPS'}</div>
                  </div>
                  <div style={{ padding: '1rem 2rem', borderRadius: '12px', background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)' }}>
                    <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--accent-2)' }}>{aiStats?.stage?.toUpperCase() || '—'}</div>
                    <div style={{ fontSize: '0.8rem', color: '#aaa' }}>STAGE</div>
                  </div>
                </div>

                {/* Feedback */}
                {aiStats?.feedback && aiStats.feedback.length > 0 && (
                  <div style={{ padding: '0.75rem 1rem', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', marginBottom: '1.5rem', textAlign: 'left', maxWidth: '500px', margin: '0 auto 1.5rem' }}>
                    {aiStats.feedback.map((tip: string, i: number) => (
                      <div key={i} style={{ padding: '2px 0', fontSize: '0.85rem', color: tip.includes('Good') ? '#4ade80' : '#f59e0b' }}>
                        {tip.includes('Good') ? '✅' : '⚠️'} {tip}
                      </div>
                    ))}
                  </div>
                )}

                {/* Controls */}
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  {exerciseType === 'mixed' && (
                    <>
                      <button onClick={() => switchExercise('squat')} disabled={activeExercise === 'squat'}
                        style={{ padding: '0.6rem 1.2rem', borderRadius: '10px', background: activeExercise === 'squat' ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.06)', color: activeExercise === 'squat' ? '#818cf8' : '#aaa', border: activeExercise === 'squat' ? '2px solid #818cf8' : '1px solid rgba(255,255,255,0.1)', fontWeight: 'bold', cursor: activeExercise === 'squat' ? 'default' : 'pointer' }}>
                        🦵 Squats
                      </button>
                      <button onClick={() => switchExercise('pushup')} disabled={activeExercise === 'pushup'}
                        style={{ padding: '0.6rem 1.2rem', borderRadius: '10px', background: activeExercise === 'pushup' ? 'rgba(6,182,212,0.2)' : 'rgba(255,255,255,0.06)', color: activeExercise === 'pushup' ? '#22d3ee' : '#aaa', border: activeExercise === 'pushup' ? '2px solid #22d3ee' : '1px solid rgba(255,255,255,0.1)', fontWeight: 'bold', cursor: activeExercise === 'pushup' ? 'default' : 'pointer' }}>
                        💪 Pushups
                      </button>
                    </>
                  )}
                  <button onClick={stopCamera} style={{ padding: '0.6rem 1.5rem', borderRadius: '10px', background: 'rgba(255,80,80,0.15)', color: '#ff6b6b', border: '1px solid rgba(255,80,80,0.3)', fontWeight: 'bold', cursor: 'pointer' }}>
                    ⏹ Stop
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <h3 style={{ marginBottom: '1rem', fontSize: '1.3rem' }}>🎯 AI Exercise Tracker</h3>
                <p style={{ fontSize: '0.85rem', color: '#aaa', marginBottom: '2rem' }}>
                  {exerciseType === 'mixed' ? 'Choose which exercise to track:' : 'Click to start AI tracking.'}
                </p>
                <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  {(exerciseType === 'squat' || exerciseType === 'mixed') && (
                    <button onClick={() => startCamera('squat')} style={{
                      width: '130px', height: '130px', borderRadius: '65px',
                      background: 'linear-gradient(135deg, #6366f1, #818cf8)', color: '#fff',
                      fontSize: '0.9rem', fontWeight: 'bold', border: 'none', cursor: 'pointer',
                      boxShadow: '0 0 30px rgba(99,102,241,0.3)', transition: 'transform 0.15s', lineHeight: '1.4',
                    }} onMouseDown={(e: any) => e.target.style.transform = 'scale(0.93)'} onMouseUp={(e: any) => e.target.style.transform = 'scale(1)'}>
                      🦵<br />START<br />SQUATS
                    </button>
                  )}
                  {(exerciseType === 'pushup' || exerciseType === 'mixed') && (
                    <button onClick={() => startCamera('pushup')} style={{
                      width: '130px', height: '130px', borderRadius: '65px',
                      background: 'linear-gradient(135deg, #06b6d4, #22d3ee)', color: '#fff',
                      fontSize: '0.9rem', fontWeight: 'bold', border: 'none', cursor: 'pointer',
                      boxShadow: '0 0 30px rgba(6,182,212,0.3)', transition: 'transform 0.15s', lineHeight: '1.4',
                    }} onMouseDown={(e: any) => e.target.style.transform = 'scale(0.93)'} onMouseUp={(e: any) => e.target.style.transform = 'scale(1)'}>
                      💪<br />START<br />PUSHUPS
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════
          INLINE LEADERBOARD
          ═════════════════════════════════════════════════════════════════════ */}
      <div style={{ width: '100%', maxWidth: '900px', margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '1.5rem', fontSize: '1.5rem' }}>🏆 Leaderboard</h2>

        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '20px', overflow: 'hidden' }}>
          {/* Header row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '50px 1fr 120px 120px 100px',
            padding: '1rem 1.5rem',
            borderBottom: '1px solid var(--card-border)',
            fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.05em',
          }}>
            <div>#</div>
            <div>Team</div>
            <div style={{ textAlign: 'center' }}>Progress</div>
            <div style={{ textAlign: 'center' }}>Time</div>
            <div style={{ textAlign: 'center' }}>Status</div>
          </div>

          {/* Team rows */}
          {rankedTeams.map((team: any, idx: number) => {
            const isMyTeam = myTeam && team._id === myTeam._id;
            const color = getColor(team.teamName);
            const totalTarget = (exerciseType === 'mixed')
              ? challenge.targetSquats + challenge.targetPushups
              : (exerciseType === 'squat' ? challenge.targetSquats : challenge.targetPushups);

            return (
              <div key={team._id || idx} style={{
                display: 'grid',
                gridTemplateColumns: '50px 1fr 120px 120px 100px',
                alignItems: 'center',
                padding: '1.25rem 1.5rem',
                borderBottom: idx < rankedTeams.length - 1 ? '1px solid var(--card-border)' : 'none',
                background: isMyTeam ? 'rgba(99,102,241,0.06)' : 'transparent',
                transition: 'background 0.2s',
              }}>
                {/* Rank */}
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.85rem', fontWeight: 'bold',
                  background: idx === 0 ? 'linear-gradient(135deg, #fbbf24, #f59e0b)' : idx === 1 ? 'rgba(192,192,192,0.15)' : idx === 2 ? 'rgba(205,127,50,0.15)' : 'rgba(255,255,255,0.04)',
                  color: idx === 0 ? '#000' : idx === 1 ? '#c0c0c0' : idx === 2 ? '#cd7f32' : '#888',
                }}>
                  {idx + 1}
                </div>

                {/* Team name + progress bar */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, display: 'inline-block' }}></span>
                    <span style={{ fontWeight: 'bold', color }}>
                      Team {team.teamName}
                      {isMyTeam && <span style={{ fontSize: '0.7rem', color: '#aaa', marginLeft: '0.5rem' }}>(You)</span>}
                    </span>
                  </div>
                  {/* Progress bars */}
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {(exerciseType === 'squat' || exerciseType === 'mixed') && (
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.7rem', color: '#888', marginBottom: '2px' }}>🦵 {team.totalSquats}/{challenge.targetSquats}</div>
                        {renderBar(team.totalSquats, challenge.targetSquats, color)}
                      </div>
                    )}
                    {(exerciseType === 'pushup' || exerciseType === 'mixed') && (
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.7rem', color: '#888', marginBottom: '2px' }}>💪 {team.totalPushups}/{challenge.targetPushups}</div>
                        {renderBar(team.totalPushups, challenge.targetPushups, color)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Time */}
                <div style={{ textAlign: 'center', fontSize: '0.9rem', fontWeight: 'bold', color: team.timeTakenMs ? '#fbbf24' : '#555' }}>
                  {team.timeTakenMs ? formatTime(team.timeTakenMs) : '—'}
                </div>

                {/* Status */}
                <div style={{ textAlign: 'center' }}>
                  {team.completed ? (
                    <span style={{ padding: '0.25rem 0.6rem', borderRadius: '20px', background: 'rgba(74,222,128,0.1)', color: '#4ade80', fontSize: '0.75rem', fontWeight: 'bold' }}>
                      ✅ Done
                    </span>
                  ) : team.startedWorkoutAt ? (
                    <span style={{ padding: '0.25rem 0.6rem', borderRadius: '20px', background: 'rgba(251,191,36,0.1)', color: '#fbbf24', fontSize: '0.75rem', fontWeight: 'bold' }}>
                      ⏳ In Progress
                    </span>
                  ) : (
                    <span style={{ padding: '0.25rem 0.6rem', borderRadius: '20px', background: 'rgba(255,255,255,0.04)', color: '#888', fontSize: '0.75rem', fontWeight: 'bold' }}>
                      Not Started
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p style={{ textAlign: 'center', color: '#555', fontSize: '0.8rem', marginTop: '1rem' }}>
          Completed teams ranked by fastest time · In-progress teams ranked by total reps
        </p>
      </div>

      <style jsx>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </div>
  );
}