"use client";

import Link from "next/link";
import { Activity, Menu, X } from "lucide-react";
import { useState } from "react";

export function FutureNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity duration-300 md:hidden ${mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      <div className="fixed top-3 left-0 right-0 z-50 border-y border-white/10 bg-black/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 sm:gap-3 group shrink-0"
          >
            <h2 className="font-mono text-lg sm:text-2xl font-bold tracking-widest uppercase italic text-white drop-shadow-md group-hover:text-zinc-300 transition-colors">
              FitConquest
            </h2>
            <div className="h-5 w-px bg-white/10 hidden lg:block"></div>
            <span className="text-zinc-500 text-xs font-mono whitespace-nowrap hidden lg:block tracking-widest uppercase">
              EST. 2026
            </span>
          </Link>

          <div className="flex items-center gap-6 lg:gap-10">
            {/* Desktop nav */}
            <ul className="hidden md:flex items-center gap-6 lg:gap-8 font-mono text-xs text-zinc-400 font-semibold uppercase tracking-widest">
              <li>
                <Link
                  href="/feature1"
                  className="hover:text-white transition-colors"
                >
                  Activity
                </Link>
              </li>
              <li>
                <Link
                  href="/feature2"
                  className="hover:text-white transition-colors"
                >
                  Squad Arena
                </Link>
              </li>
              <li>
                <Link
                  href="/feature1/leaderboard"
                  className="hover:text-white transition-colors"
                >
                  Leaderboard
                </Link>
              </li>
            </ul>

            <div className="hidden lg:flex items-center gap-3 text-[10px] font-mono text-zinc-500 border-l border-white/10 pl-6 tracking-widest">
              <span>SYS.ACT</span>
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-white/80 rounded-full animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.8)]"></div>
              </div>
              <Activity className="w-3.5 h-3.5 text-zinc-400" />
            </div>

            {/* Mobile hamburger */}
            <button
              className="md:hidden flex items-center justify-center w-9 h-9 text-zinc-400 hover:text-white transition-colors cursor-pointer bg-white/3 border border-white/10"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        <div
          className={`md:hidden border-t border-white/10 bg-black/95 backdrop-blur-md overflow-hidden transition-all duration-300 ease-out ${mobileOpen ? "max-h-105 opacity-100 translate-y-0" : "max-h-0 opacity-0 -translate-y-2"}`}
        >
          <nav className="flex flex-col px-5 py-4 gap-2">
            <Link
              href="/feature1"
              onClick={() => setMobileOpen(false)}
              className="font-mono text-sm text-zinc-300 py-3 px-3 border border-white/10 hover:text-white hover:border-white/30 transition-colors uppercase tracking-widest no-underline"
            >
              Activity Map
            </Link>
            <Link
              href="/feature2"
              onClick={() => setMobileOpen(false)}
              className="font-mono text-sm text-zinc-300 py-3 px-3 border border-white/10 hover:text-white hover:border-white/30 transition-colors uppercase tracking-widest no-underline"
            >
              Squad Arena
            </Link>
            <Link
              href="/feature1/leaderboard"
              onClick={() => setMobileOpen(false)}
              className="font-mono text-sm text-zinc-300 py-3 px-3 border border-white/10 hover:text-white hover:border-white/30 transition-colors uppercase tracking-widest no-underline"
            >
              Leaderboard
            </Link>
            <Link
              href="/features"
              onClick={() => setMobileOpen(false)}
              className="font-mono text-sm text-zinc-300 py-3 px-3 border border-white/10 hover:text-white hover:border-white/30 transition-colors uppercase tracking-widest no-underline"
            >
              Features
            </Link>
            <Link
              href="/contact"
              onClick={() => setMobileOpen(false)}
              className="font-mono text-sm text-zinc-300 py-3 px-3 border border-white/10 hover:text-white hover:border-white/30 transition-colors uppercase tracking-widest no-underline"
            >
              Contact
            </Link>
          </nav>
        </div>
      </div>
    </>
  );
}
