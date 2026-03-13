"use client";

import { useEffect, useState, useRef, use } from "react";
import io from "socket.io-client";
import Link from "next/link";

let socket: any;

const AI_ENGINE_URL = "http://localhost:5050";

export default function Arena({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const challengeId = unwrappedParams.id;
  const [challenge, setChallenge] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [repCount, setRepCount] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [aiStats, setAiStats] = useState<any>(null);
  const [exerciseType, setExerciseType] = useState<"squat" | "pushup">("squat");
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const prevCountRef = useRef(0);

  // ── Use refs so polling callback always has fresh values ──────────────
  const challengeRef = useRef<any>(null);
  const userRef = useRef<any>(null);

  // Keep refs in sync with state
  useEffect(() => { challengeRef.current = challenge; }, [challenge]);
  useEffect(() => { userRef.current = user; }, [user]);

  // ── Socket & user setup ──────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem("fit_token");
    if (!token) {
      window.location.href = "/feature2";
      return;
    }

    fetchUser(token);

    socket = io(process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080", {
      extraHeaders: {
        "ngrok-skip-browser-warning": "true",
      }
    });

    socket.emit("join_challenge", challengeId);

    socket.on("score_update", (data: any) => {
      setChallenge((prev: any) => {
        if (!prev) return prev;
        return { ...prev, teams: data.teams, winnerTeam: data.winnerTeam, status: data.status || prev.status };
      });
    });

    socket.on("challenge_started", () => {
      setCountdown(3);
      setChallenge((prev: any) => ({ ...prev, status: 'active' }));
    });

    socket.on("challenge_completed", (data: any) => {
      alert(`Challenge Completed! Winner: Team ${data.winnerTeam}`);
      setChallenge((prev: any) => ({ ...prev, status: "completed", winnerTeam: data.winnerTeam }));
      stopCamera();
    });

    return () => {
      if (socket) socket.disconnect();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [challengeId]);

  // ── Countdown timer ──────────────────────────────────────────────────────
  useEffect(() => {
    if (countdown === null) return;
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCountdown(null);
    }
  }, [countdown]);

  // ── Fetch user ───────────────────────────────────────────────────────────
  const fetchUser = async (token: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true'
        },
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        userRef.current = userData;
        fetchChallenge();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // ── Fetch challenge ──────────────────────────────────────────────────────
  const fetchChallenge = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/challenges/${challengeId}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      if (res.ok) {
        const challengeData = await res.json();
        setChallenge(challengeData);
        challengeRef.current = challengeData;
      }
    } catch (e) {
      console.error(e);
    }
  };

  // ── Emit rep to socket (uses refs, not stale state) ──────────────────────
  const emitRep = (count: number) => {
    const currentChallenge = challengeRef.current;
    const currentUser = userRef.current;

    if (!currentChallenge || currentChallenge.status !== 'active' || !currentUser) {
      console.log("[emitRep] Skipped — challenge:", currentChallenge?.status, "user:", !!currentUser);
      return;
    }

    const userId = currentUser._id || currentUser.id;
    let myTeamId = null;

    for (let i = 0; i < currentChallenge.teams.length; i++) {
      if (currentChallenge.teams[i].members.some((m: any) => m._id === userId || m === userId)) {
        myTeamId = currentChallenge.teams[i]._id;
        break;
      }
    }

    if (!myTeamId) {
      console.log("[emitRep] Skipped — user not in any team");
      return;
    }

    console.log(`[emitRep] Emitting ${count} rep(s) for team ${myTeamId}`);

    socket.emit("squat_performed", {
      challengeId,
      teamId: myTeamId,
      userId,
      count,
    });
  };

  // ── Start camera / AI engine ─────────────────────────────────────────────
  const startCamera = async () => {
    try {
      // 1. Tell the AI engine which exercise to track
      await fetch(`${AI_ENGINE_URL}/exercise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exercise: exerciseType }),
      });

      // 2. Reset counter
      await fetch(`${AI_ENGINE_URL}/reset`, { method: "POST" });

      // 3. Show the video feed
      setCameraActive(true);
      prevCountRef.current = 0;
      setRepCount(0);

      // 4. Start polling stats
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`${AI_ENGINE_URL}/stats`);
          if (res.ok) {
            const data = await res.json();
            setAiStats(data);
            setRepCount(data.count);

            // Emit new reps to socket
            const newReps = data.count - prevCountRef.current;
            if (newReps > 0) {
              emitRep(newReps);
              prevCountRef.current = data.count;
            }
          }
        } catch (e) {
          // AI engine might not be running
        }
      }, 500);
    } catch (e) {
      console.error("Failed to connect to AI Engine:", e);
      alert("Could not connect to AI Engine. Make sure to run: python app.py (in ai-engine folder)");
    }
  };

  // ── Stop camera ──────────────────────────────────────────────────────────
  const stopCamera = () => {
    setCameraActive(false);
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  // ── Start challenge ──────────────────────────────────────────────────────
  const startChallenge = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/challenges/${challengeId}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('fit_token')}`,
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ userId: user._id || user.id })
      });
      if (res.ok) {
        socket.emit("start_challenge", challengeId);
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (!challenge || !user) return <div style={{padding: '10rem', textAlign: 'center'}}>Loading Arena...</div>;

  const redTeam = challenge.teams[0];
  const blueTeam = challenge.teams[1];

  const redPercentage = Math.min((redTeam.totalSquats / challenge.targetSquats) * 100, 100);
  const bluePercentage = Math.min((blueTeam.totalSquats / challenge.targetSquats) * 100, 100);

  const isHost = challenge.host._id === (user._id || user.id);
  const userId = user._id || user.id;
  const myTeam = redTeam.members.some((m: any) => m._id === userId || m === userId) ? 'Red' :
                 blueTeam.members.some((m: any) => m._id === userId || m === userId) ? 'Blue' : null;
  const canStart = redTeam.members.length > 0 && blueTeam.members.length > 0;

  return (
    <div className="feature-page" style={{ padding: '8rem 5% 4rem' }}>
      <Link href="/feature2" className="back-link" style={{marginBottom: '2rem'}}>← Back to Squads</Link>

      <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 'bold' }}>{challenge.title}</h1>
        <p className="subtitle" style={{margin: '0 auto'}}>Target: {challenge.targetSquats} Reps</p>
        {myTeam && <p style={{marginTop: '0.5rem', fontWeight: 'bold', color: myTeam === 'Red' ? '#ff8888' : '#88ccff'}}>You are playing for Team {myTeam}</p>}
        {challenge.winnerTeam && <h2 style={{color: challenge.winnerTeam === 'Red' ? '#ff8888' : '#88ccff', marginTop: '1rem'}}>WINNER: TEAM {challenge.winnerTeam.toUpperCase()}!</h2>}
      </div>

      {/* Progress Bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem', maxWidth: '800px', width: '100%', margin: '0 auto' }}>
        {/* Team Red */}
        <div>
          <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: '#ff8888', fontWeight: 'bold'}}>
            <span>Team Red (HP)</span>
            <span>{redTeam.totalSquats} / {challenge.targetSquats}</span>
          </div>
          <div style={{ width: '100%', height: '30px', background: 'rgba(255,100,100,0.1)', borderRadius: '15px', overflow: 'hidden', border: '1px solid rgba(255,100,100,0.3)' }}>
            <div style={{ width: `${redPercentage}%`, height: '100%', background: 'linear-gradient(90deg, #ff8888, #ff5555)', transition: 'width 0.3s ease-out' }}></div>
          </div>
        </div>

        {/* Team Blue */}
        <div>
          <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: '#88ccff', fontWeight: 'bold'}}>
            <span>Team Blue (HP)</span>
            <span>{blueTeam.totalSquats} / {challenge.targetSquats}</span>
          </div>
          <div style={{ width: '100%', height: '30px', background: 'rgba(100,200,255,0.1)', borderRadius: '15px', overflow: 'hidden', border: '1px solid rgba(100,200,255,0.3)' }}>
            <div style={{ width: `${bluePercentage}%`, height: '100%', background: 'linear-gradient(90deg, #88ccff, #55aaff)', transition: 'width 0.3s ease-out' }}></div>
          </div>
        </div>
      </div>

      {/* Waiting for Players */}
      {challenge.status === 'upcoming' && (
        <div style={{ marginTop: '5rem', textAlign: 'center' }}>
          <div style={{ padding: '2rem', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '20px', maxWidth: '400px', margin: '0 auto', backdropFilter: 'blur(12px)' }}>
            <h3 style={{marginBottom: '1rem'}}>Waiting for Players...</h3>
            <p style={{fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--accent-2)', marginBottom: '1rem'}}>
              Red: {redTeam.members.length} | Blue: {blueTeam.members.length}
            </p>
            {isHost && (
               <button
                  onClick={startChallenge}
                  disabled={!canStart}
                  style={{
                    padding: '0.8rem 2rem', borderRadius: '8px',
                    background: !canStart ? '#555' : 'var(--accent-1)',
                    color: 'white', fontWeight: 'bold', border: 'none',
                    cursor: !canStart ? 'not-allowed' : 'pointer'
                  }}
               >
                START CHALLENGE
               </button>
            )}
            {!isHost && <p style={{color: '#aaa', fontSize: '0.9rem'}}>Waiting for the host to start the match...</p>}
          </div>
        </div>
      )}

      {/* AI Camera Section */}
      {challenge.status !== 'upcoming' && (
        <div style={{ marginTop: '5rem', textAlign: 'center', width: '100%', maxWidth: '900px', margin: '5rem auto 0' }}>
          {countdown !== null ? (
            <div style={{ fontSize: '6rem', fontWeight: 'bold', color: 'var(--accent-1)' }}>
              {countdown === 0 ? "GO!" : countdown}
            </div>
          ) : (
            <div style={{
              padding: '2rem',
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              borderRadius: '20px',
              backdropFilter: 'blur(12px)',
            }}>
              <h3 style={{marginBottom: '1rem', fontSize: '1.4rem'}}>
                🎯 AI Exercise Tracker
              </h3>

              {/* Exercise Type Selector */}
              {!cameraActive && (
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginBottom: '1.5rem' }}>
                  <button
                    onClick={() => setExerciseType("squat")}
                    style={{
                      padding: '0.6rem 1.5rem',
                      borderRadius: '12px',
                      border: exerciseType === 'squat' ? '2px solid var(--accent-1)' : '1px solid rgba(255,255,255,0.1)',
                      background: exerciseType === 'squat' ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
                      color: exerciseType === 'squat' ? 'var(--accent-1)' : '#aaa',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '0.95rem',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    🦵 Squats
                  </button>
                  <button
                    onClick={() => setExerciseType("pushup")}
                    style={{
                      padding: '0.6rem 1.5rem',
                      borderRadius: '12px',
                      border: exerciseType === 'pushup' ? '2px solid var(--accent-2)' : '1px solid rgba(255,255,255,0.1)',
                      background: exerciseType === 'pushup' ? 'rgba(6,182,212,0.15)' : 'rgba(255,255,255,0.04)',
                      color: exerciseType === 'pushup' ? 'var(--accent-2)' : '#aaa',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '0.95rem',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    💪 Pushups
                  </button>
                </div>
              )}

              {/* Camera Feed Area */}
              {cameraActive ? (
                <div>
                  {/* Live Video Feed from AI Engine */}
                  <div style={{
                    position: 'relative',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    border: '2px solid rgba(99,102,241,0.3)',
                    marginBottom: '1.5rem',
                    background: '#000',
                  }}>
                    <img
                      src={`${AI_ENGINE_URL}/video_feed`}
                      alt="AI Exercise Detection"
                      style={{
                        width: '100%',
                        maxHeight: '480px',
                        objectFit: 'contain',
                        display: 'block',
                      }}
                    />
                    {/* Live badge */}
                    <div style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 12px',
                      borderRadius: '20px',
                      background: 'rgba(255,50,50,0.85)',
                      color: '#fff',
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                    }}>
                      <span style={{
                        width: '8px', height: '8px', borderRadius: '50%',
                        background: '#fff',
                        animation: 'pulse 1.5s infinite',
                      }}></span>
                      LIVE
                    </div>
                  </div>

                  {/* Stats Panel */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '1rem',
                    marginBottom: '1.5rem',
                  }}>
                    <div style={{
                      padding: '1rem',
                      borderRadius: '12px',
                      background: 'rgba(99,102,241,0.1)',
                      border: '1px solid rgba(99,102,241,0.2)',
                    }}>
                      <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--accent-1)' }}>
                        {repCount}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '4px' }}>
                        {exerciseType === 'squat' ? 'SQUATS' : 'PUSHUPS'}
                      </div>
                    </div>
                    <div style={{
                      padding: '1rem',
                      borderRadius: '12px',
                      background: 'rgba(6,182,212,0.1)',
                      border: '1px solid rgba(6,182,212,0.2)',
                    }}>
                      <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--accent-2)' }}>
                        {aiStats?.stage?.toUpperCase() || '—'}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '4px' }}>STAGE</div>
                    </div>
                    <div style={{
                      padding: '1rem',
                      borderRadius: '12px',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff' }}>
                        {aiStats?.angles ?
                          (exerciseType === 'squat'
                            ? `${aiStats.angles.knee_angle || 0}°`
                            : `${aiStats.angles.elbow_angle || 0}°`)
                          : '—'}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '4px' }}>
                        {exerciseType === 'squat' ? 'KNEE ANGLE' : 'ELBOW ANGLE'}
                      </div>
                    </div>
                  </div>

                  {/* Feedback */}
                  {aiStats?.feedback && aiStats.feedback.length > 0 && (
                    <div style={{
                      padding: '1rem',
                      borderRadius: '12px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      marginBottom: '1.5rem',
                      textAlign: 'left',
                    }}>
                      <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.5rem', textTransform: 'uppercase', fontWeight: 'bold' }}>
                        Form Feedback
                      </div>
                      {aiStats.feedback.map((tip: string, i: number) => (
                        <div key={i} style={{
                          padding: '4px 0',
                          fontSize: '0.9rem',
                          color: tip.includes('Good') ? '#4ade80' : '#f59e0b',
                        }}>
                          {tip.includes('Good') ? '✅' : '⚠️'} {tip}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Stop Button */}
                  <button
                    onClick={stopCamera}
                    style={{
                      padding: '0.8rem 2.5rem',
                      borderRadius: '12px',
                      background: 'rgba(255,80,80,0.2)',
                      color: '#ff6b6b',
                      border: '1px solid rgba(255,80,80,0.3)',
                      fontSize: '1rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    ⏹ Stop Camera
                  </button>
                </div>
              ) : (
                /* Start Button */
                <div>
                  <p style={{fontSize: '0.9rem', color: '#aaa', marginBottom: '2rem'}}>
                    Select your exercise and click START to begin AI-powered tracking with your webcam.
                  </p>
                  <button
                    disabled={challenge.status !== 'active'}
                    onClick={startCamera}
                    style={{
                      width: '140px',
                      height: '140px',
                      borderRadius: '70px',
                      background: challenge.status === 'active'
                        ? 'linear-gradient(135deg, var(--accent-1), var(--accent-2))'
                        : '#555',
                      color: '#fff',
                      fontSize: '1.3rem',
                      fontWeight: 'bold',
                      border: 'none',
                      cursor: challenge.status === 'active' ? 'pointer' : 'not-allowed',
                      boxShadow: challenge.status === 'active' ? '0 0 40px var(--glow-1), 0 0 80px var(--glow-2)' : 'none',
                      transition: 'transform 0.15s ease, box-shadow 0.3s ease',
                      letterSpacing: '0.05em',
                    }}
                    onMouseDown={(e: any) => e.target.style.transform = 'scale(0.93)'}
                    onMouseUp={(e: any) => e.target.style.transform = 'scale(1)'}
                  >
                    {challenge.status === 'active' ? '▶ START' : 'FINISHED'}
                  </button>
                  <div style={{marginTop: '1.5rem', fontSize: '0.85rem', color: '#666'}}>
                    Selected: <strong style={{color: exerciseType === 'squat' ? 'var(--accent-1)' : 'var(--accent-2)'}}>
                      {exerciseType === 'squat' ? '🦵 Squats' : '💪 Pushups'}
                    </strong>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Pulse animation for LIVE badge */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
