"use client";

import { useState, useEffect, useCallback } from "react";

// ============================================================================
// TYPES
// ============================================================================

interface LeaderboardUser {
    _id: string;
    username: string;
    stats: {
        totalSquats: number;
        challengesWon: number;
    };
    location: {
        city?: string;
        state?: string;
        country?: string;
    };
}

type TabType = "daily" | "weekly" | "monthly" | "global";

const TABS: { key: TabType; label: string }[] = [
    { key: "daily", label: "Daily" },
    { key: "weekly", label: "Weekly" },
    { key: "monthly", label: "Monthly" },
    { key: "global", label: "Overall" },
];

const API_BASE =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

// ============================================================================
// COMPONENT
// ============================================================================

export default function LeaderboardPanel() {
    const [activeTab, setActiveTab] = useState<TabType>("daily");
    const [users, setUsers] = useState<LeaderboardUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // ========================================================================
    // FETCH LEADERBOARD
    // ========================================================================

    const fetchLeaderboard = useCallback(async (tab: TabType) => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(
                `${API_BASE}/api/leaderboard?type=${tab}`
            );

            if (!res.ok) {
                throw new Error(`Failed to fetch leaderboard (${res.status})`);
            }

            const data: LeaderboardUser[] = await res.json();
            setUsers(data);
        } catch (err: unknown) {
            const message =
                err instanceof Error ? err.message : "Unknown error";
            console.error("Leaderboard fetch error:", message);
            setError(message);
            setUsers([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLeaderboard(activeTab);
    }, [activeTab, fetchLeaderboard]);

    // Auto-refresh every 30s
    useEffect(() => {
        const interval = setInterval(() => {
            fetchLeaderboard(activeTab);
        }, 30_000);
        return () => clearInterval(interval);
    }, [activeTab, fetchLeaderboard]);

    // ========================================================================
    // DERIVED VALUES
    // ========================================================================

    const maxSquats = users.length > 0 ? users[0].stats.totalSquats : 1;
    const totalParticipants = users.length;
    const totalSquatsSum = users.reduce(
        (sum, u) => sum + u.stats.totalSquats,
        0
    );

    // ========================================================================
    // HELPERS
    // ========================================================================

    const getRankDisplay = (rank: number): string => {
        if (rank === 1) return "🥇";
        if (rank === 2) return "🥈";
        if (rank === 3) return "🥉";
        return `${rank}`;
    };

    const getRowClass = (rank: number): string => {
        if (rank === 1) return "lb-row lb-row--gold";
        if (rank === 2) return "lb-row lb-row--silver";
        if (rank === 3) return "lb-row lb-row--bronze";
        return "lb-row";
    };

    const getRankClass = (rank: number): string => {
        if (rank <= 3) return `lb-rank lb-rank--${rank}`;
        return "lb-rank";
    };

    const formatNumber = (num: number): string => {
        return num.toLocaleString("en-IN");
    };

    // ========================================================================
    // RENDER
    // ========================================================================

    return (
        <aside className="feature1-sidebar" id="feature1-leaderboard">
            {/* Header */}
            <div className="lb-header">
                <h2>🏆 Leaderboard</h2>
                <p>Top performers across the FitConquest community</p>
            </div>

            {/* Tabs */}
            <div className="lb-tabs" role="tablist" aria-label="Leaderboard time range">
                {TABS.map((tab) => (
                    <button
                        key={tab.key}
                        role="tab"
                        aria-selected={activeTab === tab.key}
                        className={`lb-tab${activeTab === tab.key ? " lb-tab--active" : ""}`}
                        onClick={() => setActiveTab(tab.key)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Leaderboard List */}
            {loading ? (
                <div className="lb-loading">
                    <div className="lb-spinner" />
                    <span>Loading leaderboard…</span>
                </div>
            ) : error ? (
                <div className="lb-empty">
                    <span className="lb-empty-icon">⚠️</span>
                    <span>Failed to load: {error}</span>
                </div>
            ) : users.length === 0 ? (
                <div className="lb-empty">
                    <span className="lb-empty-icon">🏋️</span>
                    <span>
                        No data yet for this period.
                        <br />
                        Start squatting to get on the board!
                    </span>
                </div>
            ) : (
                <div className="lb-list-wrapper">
                    <div className="lb-list" role="list">
                        {users.map((user, idx) => {
                            const rank = idx + 1;
                            const progress =
                                maxSquats > 0
                                    ? (user.stats.totalSquats / maxSquats) * 100
                                    : 0;

                            return (
                                <div
                                    key={user._id}
                                    className={getRowClass(rank)}
                                    role="listitem"
                                >
                                    {/* Rank */}
                                    <div className={getRankClass(rank)}>
                                        {getRankDisplay(rank)}
                                    </div>

                                    {/* User Info */}
                                    <div className="lb-info">
                                        <div className="lb-username">{user.username}</div>
                                        {user.location?.city && (
                                            <div className="lb-location">
                                                📍 {user.location.city}
                                                {user.location.state
                                                    ? `, ${user.location.state}`
                                                    : ""}
                                            </div>
                                        )}
                                    </div>

                                    {/* Squat Count */}
                                    <div className="lb-squats">
                                        <div className="lb-squats-value">
                                            {formatNumber(user.stats.totalSquats)}
                                        </div>
                                        <div className="lb-squats-label">squats</div>
                                    </div>

                                    {/* Progress bar */}
                                    <div
                                        className="lb-progress"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Footer Stats */}
            <div className="lb-footer">
                <div className="lb-footer-card">
                    <div className="lb-stat">
                        <div className="lb-stat-label">Participants</div>
                        <div className="lb-stat-value">{totalParticipants}</div>
                    </div>
                    <div className="lb-stat">
                        <div className="lb-stat-label">Total Squats</div>
                        <div className="lb-stat-value lb-stat-value--accent">
                            {formatNumber(totalSquatsSum)}
                        </div>
                    </div>
                </div>
            </div>
        </aside>
    );
}
