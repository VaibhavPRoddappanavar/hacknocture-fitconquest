"use client";

import { useEffect, useState, use } from "react";
import io from "socket.io-client";
import Link from "next/link";

let socket: any;

export default function Arena({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  const challengeId = unwrappedParams.id;
  const [challenge, setChallenge] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [squatCount, setSquatCount] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("fit_token");
    if (!token) {
      window.location.href = "/feature2";
      return;
    }
    
    // Init user
    fetchUser(token);
    
    // Init socket with ngrok warning bypass headers
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
    });

    return () => {
      if (socket) socket.disconnect();
    };
  }, [challengeId]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCountdown(null); // time's up
    }
  }, [countdown]);

  const fetchUser = async (token: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/auth/me`, {
        headers: { 
            Authorization: `Bearer ${token}`,
            'ngrok-skip-browser-warning': 'true'
        },
      });
      if (res.ok) {
        setUser(await res.json());
        fetchChallenge();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchChallenge = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/challenges/${challengeId}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      if (res.ok) setChallenge(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const performSquat = () => {
    if (!challenge || challenge.status !== 'active') return;
    
    const userId = user._id || user.id;
    let myTeamId = null;
    let isRed = false;

    // determine team
    for (let i = 0; i < challenge.teams.length; i++) {
        if (challenge.teams[i].members.some((m:any) => m._id === userId || m === userId)) {
            myTeamId = challenge.teams[i]._id;
            break;
        }
    }

    if (!myTeamId) return;

    // Optimistic UI update
    setSquatCount(prev => prev + 1);

    // Emit event
    socket.emit("squat_performed", {
      challengeId,
      teamId: myTeamId,
      userId,
      count: 1
    });
  };

  if (!challenge || !user) return <div style={{padding: '10rem', textAlign: 'center'}}>Loading Arena...</div>;

  const redTeam = challenge.teams[0];
  const blueTeam = challenge.teams[1];
  
  const redPercentage = Math.min((redTeam.totalSquats / challenge.targetSquats) * 100, 100);
  const bluePercentage = Math.min((blueTeam.totalSquats / challenge.targetSquats) * 100, 100);

  const totalMembers = redTeam.members.length + blueTeam.members.length;
  const isHost = challenge.host._id === (user._id || user.id);
  const userId = user._id || user.id;
  const myTeam = redTeam.members.some((m:any) => m._id === userId || m === userId) ? 'Red' : 
                 blueTeam.members.some((m:any) => m._id === userId || m === userId) ? 'Blue' : null;
  const canStart = redTeam.members.length > 0 && blueTeam.members.length > 0;

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
        // Broadcast Start via Socket
        socket.emit("start_challenge", challengeId);
      } else {
         const data = await res.json();
         alert(data.error);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="feature-page" style={{ padding: '8rem 5% 4rem' }}>
      <Link href="/feature2" className="back-link" style={{marginBottom: '2rem'}}>← Back to Squads</Link>

      <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 'bold' }}>{challenge.title}</h1>
        <p className="subtitle" style={{margin: '0 auto'}}>Target: {challenge.targetSquats} Squats</p>
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

      {/* Camera Simulation */}
      {challenge.status !== 'upcoming' && (
        <div style={{ marginTop: '5rem', textAlign: 'center' }}>
          {countdown !== null ? (
            <div style={{ fontSize: '6rem', fontWeight: 'bold', color: 'var(--accent-1)' }}>
              {countdown === 0 ? "GO!" : countdown}
            </div>
          ) : (
            <div style={{ padding: '2rem', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '20px', maxWidth: '400px', margin: '0 auto', backdropFilter: 'blur(12px)' }}>
              <h3 style={{marginBottom: '1rem'}}>AI Camera Simulator</h3>
              <p style={{fontSize: '0.9rem', color: '#aaa', marginBottom: '2rem'}}>
                Click start to simulate a performing squat.
              </p>
          <button 
            disabled={challenge.status !== 'active'}
            onClick={performSquat}
            style={{ 
              width: '120px', height: '120px', borderRadius: '60px', 
              background: challenge.status === 'active' ? 'var(--accent-1)' : '#555', 
              color: '#fff', fontSize: '1.2rem', fontWeight: 'bold', border: 'none', 
              cursor: challenge.status === 'active' ? 'pointer' : 'not-allowed', 
              boxShadow: challenge.status === 'active' ? '0 0 30px var(--glow-1)' : 'none',
              transition: 'transform 0.1s'
            }}
            onMouseDown={(e:any) => e.target.style.transform = 'scale(0.95)' }
            onMouseUp={(e:any) => e.target.style.transform = 'scale(1)' }
          >
            {challenge.status === 'active' ? 'SQUAT!' : 'FINISHED'}
          </button>
          <div style={{marginTop: '2rem', fontSize: '2rem', fontWeight: 'bold'}}>
            {squatCount}
          </div>
        </div>
        )}
      </div>
      )}
    </div>
  );
}
