"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Shield, Coins, Gift, Handshake, ShieldCheck, ChevronRight } from "lucide-react";

export default function Shop() {
  const [balance, setBalance] = useState<{ flexCoins: number; activeShield: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ msg: string; type: "success" | "error" } | null>(null);

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
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"}/api/shop/balance`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "ngrok-skip-browser-warning": "true",
          },
        },
      );
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
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"}/api/shop/buy-shield`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "ngrok-skip-browser-warning": "true",
          },
          body: JSON.stringify({ shieldType }),
        },
      );
      const data = await res.json();
      if (res.ok) {
        setBalance({ flexCoins: data.flexCoins, activeShield: data.activeShield });
        setFeedback({ msg: data.message, type: "success" });
      } else {
        setFeedback({ msg: data.error || "Failed to purchase", type: "error" });
      }
    } catch (e) {
      setFeedback({ msg: "Network error", type: "error" });
    }
  };

  const buySponsorProduct = async (amount: number, productId: string) => {
    setFeedback(null);
    const token = localStorage.getItem("fit_token");
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"}/api/shop/sponsor`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "ngrok-skip-browser-warning": "true",
          },
          body: JSON.stringify({ amount, productId }),
        },
      );
      const data = await res.json();
      if (res.ok) {
        setBalance((prev) => (prev ? { ...prev, flexCoins: data.flexCoins } : null));
        setFeedback({ msg: data.message, type: "success" });
      } else {
        setFeedback({ msg: data.error || "Failed transaction", type: "error" });
      }
    } catch (e) {
      setFeedback({ msg: "Network error", type: "error" });
    }
  };

  if (loading || !balance) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="font-mono text-sm text-zinc-500 uppercase tracking-widest">
          Entering the Shop...
        </p>
      </div>
    );
  }

  const shields = [
    { type: "bronze", name: "Bronze Shield", cost: 100, days: 1, desc: "Secure your captured territories for 24 hours." },
    { type: "silver", name: "Silver Shield", cost: 250, days: 3, desc: "Extended protection for your zones over a long weekend." },
    { type: "gold", name: "Gold Shield", cost: 400, days: 5, desc: "Premium impenetrable defense for almost an entire week." },
  ];

  const sponsorProducts = [
    { id: "mb-whey", sponsor: "MuscleBlaze", name: "Biozyme Whey Protein", cost: 1500, desc: "Premium whey protein isolate for post-workout recovery. Boosts muscle synthesis.", image: "/item1.png", discount: 15 },
    { id: "mb-pre", sponsor: "MuscleBlaze", name: "Pre-Workout 300", cost: 800, desc: "Explosive energy and laser focus for your intense FitConquest sessions.", image: "/item2.png", discount: 10 },
    { id: "mb-shaker", sponsor: "MuscleBlaze", name: "Pro Shaker Bottle", cost: 300, desc: "Leak-proof protein shaker with blender ball. BPA free.", image: "/item3.png", discount: 20 },
  ];

  return (
    <div className="min-h-screen bg-black text-white px-4 sm:px-6 lg:px-8 pt-28 sm:pt-32 pb-20">
      <div className="mx-auto w-full max-w-6xl">
        {/* Nav */}
        <Link
          href="/feature2"
          className="inline-flex items-center gap-2 font-mono text-xs font-bold text-zinc-400 border border-white/10 px-4 py-2.5 uppercase tracking-widest hover:text-white hover:border-white/30 transition-colors no-underline mb-10"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Squads
        </Link>

        {/* Header */}
        <div className="mb-16 sm:mb-20 max-w-3xl">
          <span className="font-mono inline-block mb-5 px-4 py-1.5 border border-white/20 text-white text-sm font-bold tracking-widest uppercase">
            Marketplace
          </span>
          <h1
            className="font-mono uppercase tracking-tighter text-white mb-6 font-bold"
            style={{ fontSize: "clamp(2.5rem, 5vw, 4.5rem)", lineHeight: 1.05 }}
          >
            Flex <br />
            <span className="text-zinc-500">Shop</span>
          </h1>
          <p className="font-mono text-sm sm:text-lg text-zinc-400 leading-relaxed uppercase tracking-wide max-w-2xl">
            Spend your hard-earned Flex Coins on territory shields or redeem exclusive sponsor merchandise.
          </p>
        </div>

        {/* Feedback */}
        {feedback && (
          <div
            className={`font-mono text-xs sm:text-sm font-bold text-center p-4 mb-8 border uppercase tracking-wider ${
              feedback.type === "success"
                ? "border-white/20 text-white bg-white/5"
                : "border-rose-500/30 text-rose-400 bg-rose-500/5"
            }`}
          >
            {feedback.msg}
          </div>
        )}

        {/* Status Panel */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16 sm:mb-20">
          <div className="border border-white/10 bg-white/[0.03] p-8 sm:p-12 relative text-center">
            <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-white/20" />
            <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-white/20" />
            <div className="inline-flex h-11 w-11 items-center justify-center border border-white/15 text-zinc-400 mb-4 mx-auto">
              <Coins className="h-5 w-5" />
            </div>
            <p className="font-mono text-xs text-zinc-500 uppercase tracking-widest mb-3">Your Balance</p>
            <h2 className="font-mono text-5xl sm:text-6xl font-bold text-white tracking-tighter">
              {balance.flexCoins}
            </h2>
            <p className="font-mono text-xs text-zinc-600 mt-3 uppercase tracking-wider">
              Earned via Squats & Pushups
            </p>
          </div>

          <div className="border border-white/10 bg-white/[0.03] p-8 sm:p-12 relative text-center">
            <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-white/20" />
            <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-white/20" />
            <div className="inline-flex h-11 w-11 items-center justify-center border border-white/15 text-zinc-400 mb-4 mx-auto">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <p className="font-mono text-xs text-zinc-500 uppercase tracking-widest mb-3">Active Shield</p>
            {balance.activeShield && balance.activeShield.shieldType !== "none" ? (
              <>
                <h2 className="font-mono text-4xl sm:text-5xl font-bold text-white capitalize tracking-tighter">
                  {balance.activeShield.shieldType}
                </h2>
                <p className="font-mono text-xs text-zinc-400 mt-3 uppercase tracking-wider">
                  Expires: {new Date(balance.activeShield.expiresAt).toLocaleDateString()}
                </p>
              </>
            ) : (
              <>
                <h2 className="font-mono text-4xl sm:text-5xl font-bold text-zinc-700 tracking-tighter">None</h2>
                <p className="font-mono text-xs text-zinc-600 mt-3 uppercase tracking-wider">
                  Your territories are vulnerable
                </p>
              </>
            )}
          </div>
        </div>

        {/* Territory Shields */}
        <div className="mb-16 sm:mb-20">
          <div className="flex items-center gap-3 mb-8">
            <Shield className="w-5 h-5 text-zinc-500" />
            <h2 className="font-mono text-2xl sm:text-3xl font-bold text-white uppercase tracking-tighter">
              Territory Shields
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
            {shields.map((s) => (
              <div
                key={s.type}
                className="border border-white/10 bg-white/[0.03] p-7 sm:p-9 relative group hover:border-white/25 transition-all flex flex-col min-h-[320px]"
              >
                <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-white/20" />
                <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-white/20" />
                <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-white/20" />
                <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-white/20" />

                <div className="mb-5 inline-flex h-14 w-14 items-center justify-center border border-white/15 text-zinc-300 bg-white/[0.04]">
                  <span className="font-mono text-lg font-bold">{s.days}D</span>
                </div>

                <h3 className="font-mono text-xl font-bold text-white uppercase tracking-tight mb-2">
                  {s.name}
                </h3>
                <p className="font-mono text-xs text-zinc-500 leading-relaxed mb-auto">
                  {s.desc}
                </p>

                <button
                  onClick={() => buyShield(s.type)}
                  disabled={balance.flexCoins < s.cost}
                  className={`mt-6 w-full font-mono text-sm font-bold py-4 uppercase tracking-widest transition-all cursor-pointer ${
                    balance.flexCoins >= s.cost
                      ? "bg-white text-black hover:bg-zinc-200 border-none"
                      : "bg-transparent text-zinc-600 border border-white/10 cursor-not-allowed"
                  }`}
                >
                  {balance.flexCoins >= s.cost ? `Buy for ${s.cost}` : `Need ${s.cost}`}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Sponsor Rewards */}
        <div className="mb-16 sm:mb-20">
          <div className="flex items-center gap-3 mb-8">
            <Gift className="w-5 h-5 text-zinc-500" />
            <h2 className="font-mono text-2xl sm:text-3xl font-bold text-white uppercase tracking-tighter">
              Sponsor Rewards
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-6">
            {sponsorProducts.map((p) => (
              <div
                key={p.id}
                className="border border-white/10 bg-white/[0.03] p-7 sm:p-9 relative group hover:border-white/25 transition-all flex flex-col min-h-[400px]"
              >
                <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-white/20" />
                <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-white/20" />

                {/* Discount badge */}
                <span className="absolute top-4 right-4 font-mono text-[10px] font-bold text-white bg-white/10 border border-white/20 px-2.5 py-1 uppercase tracking-widest">
                  {p.discount}% Off
                </span>

                <span className="font-mono text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">
                  {p.sponsor}
                </span>

                <div className="w-full h-40 border border-white/5 bg-white/[0.02] mb-5 flex items-center justify-center overflow-hidden">
                  <img
                    src={p.image}
                    alt={p.name}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>

                <h3 className="font-mono text-lg font-bold text-white uppercase tracking-tight mb-2">
                  {p.name}
                </h3>
                <p className="font-mono text-xs text-zinc-500 leading-relaxed mb-auto">
                  {p.desc}
                </p>

                <button
                  onClick={() => buySponsorProduct(p.cost, p.id)}
                  disabled={balance.flexCoins < p.cost}
                  className={`mt-6 w-full font-mono text-sm font-bold py-4 uppercase tracking-widest transition-all cursor-pointer ${
                    balance.flexCoins >= p.cost
                      ? "bg-white text-black hover:bg-zinc-200 border-none"
                      : "bg-transparent text-zinc-600 border border-white/10 cursor-not-allowed"
                  }`}
                >
                  {balance.flexCoins >= p.cost ? `Redeem for ${p.cost}` : `Need ${p.cost}`}
                </button>
              </div>
            ))}

            {/* Partner CTA */}
            <div className="border border-dashed border-white/15 bg-white/[0.01] p-7 sm:p-9 flex flex-col items-center justify-center text-center min-h-[400px]">
              <div className="mb-5 inline-flex h-14 w-14 items-center justify-center border border-white/10 text-zinc-600">
                <Handshake className="h-6 w-6" />
              </div>
              <h3 className="font-mono text-lg font-bold text-white uppercase tracking-tight mb-2">
                Become a Partner
              </h3>
              <p className="font-mono text-xs text-zinc-500 leading-relaxed mb-6 max-w-xs">
                Want your products featured here? Partner with FitConquest to reward thousands of active athletes.
              </p>
              <button
                onClick={() => alert("Redirecting to partner form...")}
                className="w-full font-mono text-sm font-bold text-white border border-white/20 py-4 uppercase tracking-widest hover:bg-white/5 transition-colors cursor-pointer bg-transparent"
              >
                Contact Us
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
