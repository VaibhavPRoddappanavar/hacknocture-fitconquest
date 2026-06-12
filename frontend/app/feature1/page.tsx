"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { LogOut, Home, Lock } from "lucide-react";
import dynamic from "next/dynamic";
import "./feature1.css";

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
            <h2 className="font-mono text-xl sm:text-2xl font-bold text-white uppercase tracking-tighter">Activity Map</h2>
          </div>
          <p className="font-mono text-xs text-zinc-500 uppercase tracking-widest mb-8">Authentication Required</p>
          
          <form onSubmit={login} className="flex flex-col gap-4">
            <input 
              type="text" 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              placeholder="Username" 
              className="font-mono w-full px-4 py-3 bg-white/5 border border-white/10 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-white/30 transition-colors" 
            />
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              placeholder="Password" 
              className="font-mono w-full px-4 py-3 bg-white/5 border border-white/10 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-white/30 transition-colors" 
            />
            <button 
              type="submit" 
              className="font-mono w-full py-3 bg-white text-black font-bold text-sm uppercase tracking-widest hover:bg-zinc-200 transition-colors cursor-pointer"
            >
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

  return (
    <div className="feature1-container" id="feature-1-page">
      {/* Top-left: small user chip overlayed on the map */}
      <div className="map-overlay-user-chip">
        <span className="map-user-chip-name">{user.username}</span>
        <button
          onClick={() => { localStorage.removeItem("fit_token"); setUser(null); }}
          className="map-user-chip-btn"
          title="Logout"
        >
          <LogOut className="w-3 h-3" />
        </button>
        <Link href="/" className="map-user-chip-btn" title="Home">
          <Home className="w-3 h-3" />
        </Link>
      </div>

      <MapView />
    </div>
  );
}
