"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function Shop() {
  const [balance, setBalance] = useState<{ flexCoins: number, activeShield: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const [sponsorAmount, setSponsorAmount] = useState<number | "">("");
  const [feedback, setFeedback] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchBalance();
  }, []);

  const fetchBalance = async () => {
    const token = localStorage.getItem("fit_token");
    if (!token) {
      window.location.href = "/feature2";
      return;
    }

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/shop/balance`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true'
        }
      });
      if (res.ok) {
        setBalance(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const buyShield = async (shieldType: string) => {
    setFeedback(null);
    const token = localStorage.getItem("fit_token");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/shop/buy-shield`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ shieldType })
      });
      
      const data = await res.json();
      if (res.ok) {
        setBalance({ flexCoins: data.flexCoins, activeShield: data.activeShield });
        setFeedback({ msg: data.message, type: 'success' });
      } else {
        setFeedback({ msg: data.error || "Failed to purchase", type: 'error' });
      }
    } catch (e) {
      setFeedback({ msg: "Network error", type: 'error' });
    }
  };

  const buySponsorProduct = async (amount: number, productId: string) => {
    setFeedback(null);
    const token = localStorage.getItem("fit_token");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/shop/sponsor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ amount, productId })
      });
      
      const data = await res.json();
      if (res.ok) {
        setBalance((prev) => prev ? { ...prev, flexCoins: data.flexCoins } : null);
        setFeedback({ msg: data.message, type: 'success' });
      } else {
        setFeedback({ msg: data.error || "Failed transaction", type: 'error' });
      }
    } catch (e) {
      setFeedback({ msg: "Network error", type: 'error' });
    }
  };

  if (loading || !balance) {
    return <div style={{ padding: '10rem', textAlign: 'center', color: '#fff' }}>Entering the Shop...</div>;
  }

  const shields = [
    { type: 'bronze', name: 'Bronze Shield', cost: 100, days: 1, color: '#cd7f32', desc: 'Secure your captured territories for 24 hours.' },
    { type: 'silver', name: 'Silver Shield', cost: 250, days: 3, color: '#C0C0C0', desc: 'Extended protection for your zones over a long weekend.' },
    { type: 'gold', name: 'Gold Shield', cost: 400, days: 5, color: '#FFD700', desc: 'Premium impenetrable defense for almost an entire week.' }
  ];

  const sponsorProducts = [
    { id: 'mb-whey', sponsor: 'MuscleBlaze', name: 'Biozyme Whey Protein', cost: 1500, desc: 'Premium whey protein isolate for post-workout recovery. Boosts muscle synthesis.', image: '/item1.png', discount: Math.floor(Math.random() * 20) + 10 },
    { id: 'mb-pre', sponsor: 'MuscleBlaze', name: 'Pre-Workout 300', cost: 800, desc: 'Explosive energy and laser focus for your intense FitConquest sessions.', image: '/item2.png', discount: Math.floor(Math.random() * 15) + 5 },
    { id: 'mb-shaker', sponsor: 'MuscleBlaze', name: 'Pro Shaker Bottle', cost: 300, desc: 'Leak-proof protein shaker with blender ball. BPA free.', image: '/item3.png', discount: Math.floor(Math.random() * 30) + 15 }
  ];

  return (
    <div className="feature-page" style={{ padding: '8rem 5% 4rem' }}>
      <Link href="/feature2" className="back-link" style={{ marginBottom: '2rem' }}>← Back to Squads</Link>

      {/* Header Section */}
      <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
        <h1 style={{ fontSize: '3.5rem', fontWeight: 'bold', background: 'linear-gradient(90deg, #fff, var(--accent-2))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Flex Shop 🪙
        </h1>
        <p className="subtitle" style={{ margin: '1rem auto 0', maxWidth: '600px' }}>
          Spend your hard-earned Flex Coins on territory shields or use them to purchase exclusive sponsor merchandise!
        </p>
      </div>

      {feedback && (
        <div style={{
          textAlign: 'center', padding: '1rem', marginBottom: '2rem', borderRadius: '12px',
          background: feedback.type === 'success' ? 'rgba(74, 222, 128, 0.1)' : 'rgba(248, 113, 113, 0.1)',
          color: feedback.type === 'success' ? '#4ade80' : '#f87171',
          border: `1px solid ${feedback.type === 'success' ? 'rgba(74, 222, 128, 0.2)' : 'rgba(248, 113, 113, 0.2)'}`,
          fontWeight: 'bold'
        }}>
          {feedback.msg}
        </div>
      )}

      {/* Status Panel */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '4rem' }}>
        <div style={{
          padding: '2.5rem', borderRadius: '24px', background: 'rgba(6, 182, 212, 0.05)',
          border: '1px solid rgba(6, 182, 212, 0.2)', backdropFilter: 'blur(12px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }}>
          <h3 style={{ color: '#aaa', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '0.5rem' }}>Your Balance</h3>
          <div style={{ fontSize: '4rem', fontWeight: 'bold', color: 'var(--accent-2)', textShadow: '0 0 20px rgba(6, 182, 212, 0.5)' }}>
            {balance.flexCoins} <span style={{ fontSize: '2rem' }}>🪙</span>
          </div>
          <p style={{ color: '#888', marginTop: '1rem', fontSize: '0.9rem' }}>Earned by completing Squats and Pushups</p>
        </div>

        <div style={{
          padding: '2.5rem', borderRadius: '24px', background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)', backdropFilter: 'blur(12px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }}>
          <h3 style={{ color: '#aaa', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '0.5rem' }}>Active Shield</h3>
          
          {balance.activeShield && balance.activeShield.shieldType !== 'none' ? (
            <>
              <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#fff', textTransform: 'capitalize' }}>
                {balance.activeShield.shieldType}
              </div>
              <p style={{ color: '#4ade80', marginTop: '1rem', fontWeight: 'bold' }}>
                Protects until: {new Date(balance.activeShield.expiresAt).toLocaleDateString()} {new Date(balance.activeShield.expiresAt).toLocaleTimeString()}
              </p>
            </>
          ) : (
            <>
              <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#555' }}>None</div>
              <p style={{ color: '#f87171', marginTop: '1rem', fontWeight: 'bold' }}>Your territories are vulnerable!</p>
            </>
          )}
        </div>
      </div>

      <h2 style={{ fontSize: '2rem', marginBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>🛡️ Territory Shields</h2>
      
      {/* Shields Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem', marginBottom: '5rem' }}>
        {shields.map((s) => (
          <div key={s.type} style={{
            background: 'var(--card-bg)', border: `1px solid ${s.color}44`, borderRadius: '20px',
            padding: '2rem', position: 'relative', overflow: 'hidden',
            display: 'flex', flexDirection: 'column', transition: 'transform 0.3s ease'
          }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '30px', background: `${s.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', border: `1px solid ${s.color}` }}>
              <span style={{ fontSize: '1.5rem', color: s.color, fontWeight: 'bold' }}>{s.days}D</span>
            </div>
            
            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: s.color, marginBottom: '1rem' }}>{s.name}</h3>
            <p style={{ color: '#aaa', flex: 1, marginBottom: '2rem', lineHeight: '1.6' }}>{s.desc}</p>
            
            <button 
              onClick={() => buyShield(s.type)}
              disabled={balance.flexCoins < s.cost}
              style={{
                width: '100%', padding: '1rem', borderRadius: '12px',
                background: balance.flexCoins >= s.cost ? `linear-gradient(45deg, ${s.color}dd, ${s.color})` : '#333',
                color: balance.flexCoins >= s.cost ? '#000' : '#888',
                border: 'none', fontWeight: 'bold', fontSize: '1.1rem',
                cursor: balance.flexCoins >= s.cost ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
                boxShadow: balance.flexCoins >= s.cost ? `0 4px 20px ${s.color}44` : 'none'
              }}
            >
              {balance.flexCoins >= s.cost ? `Buy for ${s.cost} 🪙` : `Need ${s.cost} 🪙`}
            </button>
          </div>
        ))}
      </div>

      {/* Sponsor Products */}
      <h2 style={{ fontSize: '2rem', marginBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>🎁 Sponsor Rewards</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem', marginBottom: '4rem' }}>
        {sponsorProducts.map((p) => (
          <div key={p.id} style={{
            background: 'var(--card-bg)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '20px',
            padding: '2rem', display: 'flex', flexDirection: 'column', transition: 'transform 0.3s ease',
            position: 'relative'
          }}>
            <div style={{ position: 'absolute', top: '-10px', right: '-10px', background: 'var(--accent-1)', color: '#fff', padding: '0.4rem 0.8rem', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.8rem', boxShadow: '0 4px 10px rgba(99, 102, 241, 0.4)', transform: 'rotate(5deg)' }}>
               🔥 {p.discount}% OFF (Loyalty Rate)
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.8rem', background: 'rgba(99, 102, 241, 0.2)', color: 'var(--accent-1)', padding: '0.3rem 0.8rem', borderRadius: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>{p.sponsor}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem', height: '160px', width: '100%', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', padding: '1rem' }}>
              <img src={p.image} alt={p.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            </div>
            
            <h3 style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>{p.name}</h3>
            <p style={{ color: '#aaa', flex: 1, marginBottom: '2rem', lineHeight: '1.6', fontSize: '0.95rem' }}>{p.desc}</p>
            
            <button 
              onClick={() => buySponsorProduct(p.cost, p.id)}
              disabled={balance.flexCoins < p.cost}
              style={{
                width: '100%', padding: '1rem', borderRadius: '12px',
                background: balance.flexCoins >= p.cost ? 'linear-gradient(45deg, var(--accent-1), #818cf8)' : '#333',
                color: balance.flexCoins >= p.cost ? '#fff' : '#888',
                border: 'none', fontWeight: 'bold', fontSize: '1.1rem',
                cursor: balance.flexCoins >= p.cost ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
                marginTop: 'auto'
              }}
            >
              {balance.flexCoins >= p.cost ? `Redeem for ${p.cost} 🪙` : `Need ${p.cost} 🪙`}
            </button>
          </div>
        ))}

        {/* New Sponsor Call to Action */}
         <div style={{
            background: 'rgba(255, 255, 255, 0.02)', border: '1px dashed rgba(255, 255, 255, 0.2)', borderRadius: '20px',
            padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🤝</div>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>Become a Partner</h3>
            <p style={{ color: '#aaa', marginBottom: '2rem', lineHeight: '1.6', fontSize: '0.95rem' }}>
               Want your products featured here? Partner with FitConquest to reward thousands of active users pushing their physical limits.
            </p>
            <button 
              onClick={() => alert("Redirecting to Sponsor contact form...")}
              style={{
                width: '100%', padding: '1rem', borderRadius: '12px',
                background: 'transparent',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.3)', fontWeight: 'bold', fontSize: '1.1rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e: any) => e.target.style.background = 'rgba(255, 255, 255, 0.05)'}
              onMouseOut={(e: any) => e.target.style.background = 'transparent'}
            >
              Contact Us
            </button>
          </div>
      </div>
    </div>
  );
}
