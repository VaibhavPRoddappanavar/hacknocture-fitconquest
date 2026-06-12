"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { LogOut, Swords, ShoppingBag, Trophy, ChevronRight, Users, Lock, Dumbbell } from "lucide-react";

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
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"}/api/auth/me`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "ngrok-skip-browser-warning": "true",
          },
        },
      );
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
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"}/api/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true",
          },
          body: JSON.stringify({ username, password }),
        },
      );
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
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"}/api/challenges`,
        {
          headers: {
            "ngrok-skip-browser-warning": "true",
          },
        },
      );
      if (res.ok) {
        setChallenges(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const joinTeam = async (challengeId: string, teamName: string) => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"}/api/challenges/${challengeId}/join`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("fit_token")}`,
            "ngrok-skip-browser-warning": "true",
          },
          body: JSON.stringify({ userId: user._id || user.id, teamName }),
        },
      );
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
    const type = c.exerciseType || "squat";
    if (type === "squat") return `${c.targetSquats} Squats`;
    if (type === "pushup") return `${c.targetPushups} Pushups`;
    if (type === "mixed")
      return `${c.targetSquats} Squats + ${c.targetPushups} Pushups`;
    return "";
  };

  // ── Login ───────────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-6 pt-20">
        <div className="w-full max-w-md border border-white/10 p-8 relative">
          <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-white/40" />
          <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-white/40" />
          <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-white/40" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-white/40" />
          
          <div className="flex items-center gap-2 mb-2">
            <Lock className="w-4 h-4 text-zinc-500" />
            <h2 className="font-mono text-xl sm:text-2xl font-bold text-white uppercase tracking-tighter">Squad Arena</h2>
          </div>
          <p className="font-mono text-xs text-zinc-500 uppercase tracking-widest mb-8">Authentication Required</p>
          
          <form onSubmit={login} className="flex flex-col gap-4">
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username"
              className="font-mono w-full px-4 py-3 bg-white/5 border border-white/10 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-white/30 transition-colors" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password"
              className="font-mono w-full px-4 py-3 bg-white/5 border border-white/10 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-white/30 transition-colors" />
            <button type="submit"
              className="font-mono w-full py-3 bg-white text-black font-bold text-sm uppercase tracking-widest hover:bg-zinc-200 transition-colors cursor-pointer">
              Login
            </button>
          </form>
          <p className="font-mono mt-6 text-xs text-zinc-500 leading-relaxed">
            Demo users: vishal, arjun, priya, rahul<br />Password: password123
          </p>
        </div>
      </div>
    );
  }

  // ── Logged In ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-black pt-20 sm:pt-24 pb-16 px-4 sm:px-6 lg:px-8" id="feature-2-page">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8 sm:mb-12">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Swords className="w-5 h-5 text-zinc-500" />
              <h1 className="pt-20 font-mono text-2xl sm:text-4xl font-bold text-white uppercase tracking-tighter">
                Squad Challenges
              </h1>
            </div>
            <p className="font-mono text-xs sm:text-sm text-zinc-500 uppercase tracking-widest">
              Welcome back, {user.username}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/feature2/shop"
              className="font-mono text-xs font-bold text-zinc-400 border border-white/10 px-4 py-2 hover:text-white hover:border-white/30 transition-colors uppercase tracking-wider no-underline flex items-center gap-1.5">
              <ShoppingBag className="w-3 h-3" /> Shop
            </Link>
            <Link href="/feature2/leaderboard"
              className="font-mono text-xs font-bold text-zinc-400 border border-white/10 px-4 py-2 hover:text-white hover:border-white/30 transition-colors uppercase tracking-wider no-underline flex items-center gap-1.5">
              <Trophy className="w-3 h-3" /> Board
            </Link>
            <button onClick={() => { localStorage.removeItem("fit_token"); setUser(null); }}
              className="font-mono text-xs font-bold text-zinc-400 border border-white/10 px-4 py-2 hover:text-white hover:border-white/30 transition-colors uppercase tracking-wider cursor-pointer bg-transparent flex items-center gap-1.5">
              <LogOut className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Solo workout banner */}
        <div className="border border-white/10 p-5 sm:p-6 mb-8 sm:mb-12 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Dumbbell className="w-4 h-4 text-zinc-400" />
              <h2 className="font-mono text-base sm:text-lg font-bold text-white uppercase tracking-tight">Individual Workouts</h2>
            </div>
            <p className="font-mono text-xs text-zinc-500 leading-relaxed">
              Not in the mood for team battles? Start a personal workout anytime.
            </p>
          </div>
          <Link href="/feature2/solo"
            className="font-mono text-xs font-bold text-black bg-white px-5 py-2.5 hover:bg-zinc-200 transition-colors uppercase tracking-widest no-underline flex items-center gap-1.5 shrink-0">
            Open Solo Zone <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Challenge grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {challenges.map((c) => {
            const userId = user._id || user.id;
            const isInRed = c.teams[0].members.find(
              (m: any) => m._id === userId || m === userId,
            );
            const isInBlue = c.teams[1].members.find(
              (m: any) => m._id === userId || m === userId,
            );
            const isParticipant = isInRed || isInBlue;

            return (
              <div key={c._id} className="border border-white/10 p-5 sm:p-6 relative group hover:border-white/20 transition-colors">
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-mono text-lg sm:text-xl font-bold text-white uppercase tracking-tight">{c.title}</h3>
                  <span className={`font-mono text-[10px] font-bold uppercase tracking-widest px-2 py-1 border ${
                    c.status === "active"
                      ? "border-white/20 text-white/70"
                      : c.status === "completed"
                        ? "border-white/10 text-zinc-500"
                        : "border-white/15 text-zinc-400"
                  }`}>
                    {c.status}
                  </span>
                </div>

                {/* Exercise badge */}
                <div className="font-mono text-xs font-bold text-zinc-400 border border-white/10 inline-block px-3 py-1.5 mb-5 uppercase tracking-wider">
                  <Dumbbell className="w-3 h-3 inline mr-1" />
                  {getExerciseLabel(c)}
                </div>

                {/* Teams */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="border border-white/8 p-3 sm:p-4">
                    <h4 className="font-mono text-xs font-bold text-zinc-300 uppercase tracking-widest mb-2">Team Red</h4>
                    <p className="font-mono text-xs text-zinc-500 flex items-center gap-1">
                      <Users className="w-3 h-3" /> {c.teams[0].members.length} Members
                    </p>
                    {!isParticipant && c.status === "upcoming" && (
                      <button onClick={() => joinTeam(c._id, "Red")}
                        className="mt-3 font-mono text-xs font-bold text-black bg-white px-3 py-1.5 hover:bg-zinc-200 transition-colors uppercase tracking-wider cursor-pointer border-none w-full">
                        Join Red
                      </button>
                    )}
                  </div>
                  <div className="border border-white/8 p-3 sm:p-4">
                    <h4 className="font-mono text-xs font-bold text-zinc-300 uppercase tracking-widest mb-2">Team Blue</h4>
                    <p className="font-mono text-xs text-zinc-500 flex items-center gap-1">
                      <Users className="w-3 h-3" /> {c.teams[1].members.length} Members
                    </p>
                    {!isParticipant && c.status === "upcoming" && (
                      <button onClick={() => joinTeam(c._id, "Blue")}
                        className="mt-3 font-mono text-xs font-bold text-black bg-white px-3 py-1.5 hover:bg-zinc-200 transition-colors uppercase tracking-wider cursor-pointer border-none w-full">
                        Join Blue
                      </button>
                    )}
                  </div>
                </div>

                {/* Enter Arena */}
                {isParticipant && (
                  <Link href={`/feature2/${c._id}`}
                    className="font-mono block w-full text-center bg-white text-black py-3 font-bold text-sm uppercase tracking-widest hover:bg-zinc-200 transition-colors no-underline">
                    Enter Arena <ChevronRight className="w-3.5 h-3.5 inline" />
                  </Link>
                )}
              </div>
            );
          })}
        </div>

        {challenges.length === 0 && (
          <div className="border border-white/10 p-12 text-center">
            <Swords className="w-8 h-8 text-zinc-600 mx-auto mb-4" />
            <p className="font-mono text-sm text-zinc-500 uppercase tracking-widest">No challenges available</p>
            <p className="font-mono text-xs text-zinc-600 mt-2">Check back soon for new squad battles</p>
          </div>
        )}

      </div>
    </div>
  );
}
