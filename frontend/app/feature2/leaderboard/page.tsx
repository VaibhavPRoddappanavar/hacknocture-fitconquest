"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function Leaderboard() {
  const [users, setUsers] = useState<any[]>([]);
  const [type, setType] = useState("global");
  const [value, setValue] = useState("");

  useEffect(() => {
    fetchLeaderboard();
  }, [type, value]);

  const fetchLeaderboard = async () => {
    try {
      const url = new URL(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/leaderboard`);
      url.searchParams.append("type", type);
      if (value) url.searchParams.append("value", value);

      const res = await fetch(url.toString());
      if (res.ok) {
        setUsers(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="feature-page" style={{ padding: '8rem 5% 4rem', alignItems: 'flex-start' }}>
      <Link href="/feature2" className="back-link" style={{marginBottom: '2rem'}}>← Back to Squads</Link>

      <div style={{ width: '100%', textAlign: 'center', marginBottom: '3rem' }}>
        <div className="page-icon" style={{margin: '0 auto 1.5rem'}}>🏆</div>
        <h1>Global Leaderboard</h1>
        <p className="subtitle" style={{margin: '0 auto'}}>Top performers across regions</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '1rem', margin: '0 auto 3rem', background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--card-border)', backdropFilter: 'blur(12px)' }}>
        <select 
          value={type} 
          onChange={(e) => { setType(e.target.value); setValue(""); }}
          style={{ padding: '0.8rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', outline: 'none' }}
        >
          <option value="global">Global</option>
          <option value="state">State</option>
          <option value="city">City</option>
        </select>
        
        {type !== 'global' && (
          <input 
            type="text" 
            placeholder={`Enter ${type} name (e.g. Kochi, Kerala)`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            style={{ padding: '0.8rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', outline: 'none', width: '250px' }}
          />
        )}
      </div>

      {/* Table */}
      <div style={{ width: '100%', maxWidth: '800px', margin: '0 auto', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '20px', overflow: 'hidden' }}>
        {users.length === 0 ? (
          <p style={{padding: '3rem', textAlign: 'center', color: '#888'}}>No top performers found here yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--card-border)' }}>
                <th style={{ padding: '1.5rem', color: '#aaa', fontWeight: '500' }}>Rank</th>
                <th style={{ padding: '1.5rem', color: '#aaa', fontWeight: '500' }}>Username</th>
                <th style={{ padding: '1.5rem', color: '#aaa', fontWeight: '500' }}>Location</th>
                <th style={{ padding: '1.5rem', color: '#aaa', fontWeight: '500', textAlign: 'right' }}>Total Squats</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u._id} style={{ borderBottom: '1px solid var(--card-border)', transition: 'background 0.2s' }} onMouseEnter={(e:any) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'} onMouseLeave={(e:any) => e.currentTarget.style.background = 'transparent'}>
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

    </div>
  );
}
