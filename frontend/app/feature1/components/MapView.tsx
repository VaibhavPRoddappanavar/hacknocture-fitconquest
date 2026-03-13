"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ============================================================================
// CONSTANTS
// ============================================================================

const API_BASE =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

const DEFAULT_CENTER: L.LatLngExpression = [12.9716, 77.5946]; // Bangalore
const DEFAULT_ZOOM = 12;
const MIN_ZOOM = 4;
const MAX_ZOOM = 19;

const TILES = {
    dark: {
        url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com">CARTO</a>',
    },
    light: {
        url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com">CARTO</a>',
    },
};

// City coordinates lookup for placing markers
const CITY_COORDS: Record<string, [number, number]> = {
    Bangalore: [12.9716, 77.5946],
    Kochi: [9.9312, 76.2673],
    Mumbai: [19.076, 72.8777],
    Delhi: [28.7041, 77.1025],
    Chennai: [13.0827, 80.2707],
    Hyderabad: [17.385, 78.4867],
    Pune: [18.5204, 73.8567],
    Kolkata: [22.5726, 88.3639],
    Ahmedabad: [23.0225, 72.5714],
    Jaipur: [26.9124, 75.7873],
};

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

type MapTheme = "dark" | "light";

// ============================================================================
// CUSTOM MARKER FACTORY
// ============================================================================

function createCustomIcon(rank: number, theme: MapTheme): L.DivIcon {
    const isTop3 = rank <= 3;
    const colors: Record<number, string> = {
        1: "#ffd700",
        2: "#c0c0c0",
        3: "#cd7f32",
    };
    const bgColor = isTop3 ? colors[rank] : (theme === "dark" ? "#6366f1" : "#4f46e5");
    const borderColor = theme === "dark" ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.15)";
    const shadow = theme === "dark"
        ? `0 4px 14px ${bgColor}66, 0 0 0 4px ${bgColor}22`
        : `0 4px 14px ${bgColor}44, 0 2px 8px rgba(0,0,0,0.15)`;

    return L.divIcon({
        className: "custom-fitness-marker",
        html: `
      <div style="
        width: ${isTop3 ? 40 : 32}px;
        height: ${isTop3 ? 40 : 32}px;
        border-radius: 50%;
        background: ${bgColor};
        border: 3px solid ${borderColor};
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: ${isTop3 ? 14 : 11}px;
        font-weight: 800;
        color: ${isTop3 ? "#000" : "#fff"};
        box-shadow: ${shadow};
        transition: transform 0.2s ease;
        cursor: pointer;
      ">${rank <= 3 ? ["🥇", "🥈", "🥉"][rank - 1] : rank}</div>
    `,
        iconSize: [isTop3 ? 40 : 32, isTop3 ? 40 : 32],
        iconAnchor: [isTop3 ? 20 : 16, isTop3 ? 20 : 16],
        popupAnchor: [0, isTop3 ? -24 : -20],
    });
}

function createPopupHTML(user: LeaderboardUser, rank: number): string {
    return `
    <div class="marker-popup-content">
      <h4>${rank <= 3 ? ["🥇", "🥈", "🥉"][rank - 1] + " " : ""}${user.username}</h4>
      <div class="popup-stats">
        <span class="popup-stat"><strong>${user.stats.totalSquats.toLocaleString("en-IN")}</strong> squats</span>
        <span class="popup-stat"><strong>${user.stats.challengesWon}</strong> wins</span>
      </div>
      <div class="popup-location">📍 ${user.location?.city || "Unknown"}${user.location?.state ? `, ${user.location.state}` : ""}</div>
    </div>
  `;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function MapView() {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<L.Map | null>(null);
    const tileLayerRef = useRef<L.TileLayer | null>(null);
    const markersRef = useRef<L.Marker[]>([]);
    const usersRef = useRef<LeaderboardUser[]>([]);
    const mapReadyRef = useRef(false);
    const [isLoading, setIsLoading] = useState(true);
    const [theme, setTheme] = useState<MapTheme>("dark");

    // ========================================================================
    // PLACE MARKERS (separated from fetch for re-use on theme change)
    // ========================================================================

    const placeMarkers = useCallback((users: LeaderboardUser[], currentTheme: MapTheme) => {
        const map = mapInstanceRef.current;
        if (!map || !mapReadyRef.current) return;

        // Remove old markers
        markersRef.current.forEach((m) => {
            try { map.removeLayer(m); } catch { /* ignore */ }
        });
        markersRef.current = [];

        if (!users.length) return;

        const bounds = L.latLngBounds([]);

        users.forEach((user, idx) => {
            const rank = idx + 1;
            const city = user.location?.city;
            let coords = city ? CITY_COORDS[city] : null;

            if (!coords) {
                coords = [
                    12.9716 + (Math.random() - 0.5) * 0.1,
                    77.5946 + (Math.random() - 0.5) * 0.1,
                ];
            } else {
                // Add slight jitter so markers don't stack perfectly
                coords = [
                    coords[0] + (Math.random() - 0.5) * 0.02,
                    coords[1] + (Math.random() - 0.5) * 0.02,
                ];
            }

            try {
                const marker = L.marker(coords, {
                    icon: createCustomIcon(rank, currentTheme),
                })
                    .bindPopup(createPopupHTML(user, rank), {
                        maxWidth: 220,
                        className: "fitness-popup",
                    })
                    .addTo(map);

                bounds.extend(coords);
                markersRef.current.push(marker);
            } catch (err) {
                console.warn("Failed to add marker:", err);
            }
        });

        // Fit map to show all markers
        if (markersRef.current.length > 1) {
            map.fitBounds(bounds.pad(0.3), { animate: true, maxZoom: 13 });
        } else if (markersRef.current.length === 1) {
            map.setView(bounds.getCenter(), 13, { animate: true });
        }
    }, []);

    // ========================================================================
    // FETCH USERS FOR MARKERS
    // ========================================================================

    const fetchAndPlaceMarkers = useCallback(async (currentTheme?: MapTheme) => {
        const map = mapInstanceRef.current;
        if (!map || !mapReadyRef.current) return;

        try {
            const res = await fetch(`${API_BASE}/api/leaderboard?type=global`);
            if (!res.ok) throw new Error("Failed");

            const users: LeaderboardUser[] = await res.json();
            usersRef.current = users;
            placeMarkers(users, currentTheme ?? theme);
        } catch (err) {
            console.error("Failed to load user markers:", err);
        }
    }, [placeMarkers, theme]);

    // ========================================================================
    // THEME TOGGLE
    // ========================================================================

    const toggleTheme = useCallback(() => {
        setTheme((prev) => {
            const next: MapTheme = prev === "dark" ? "light" : "dark";
            const map = mapInstanceRef.current;

            if (map) {
                // Swap tile layer
                if (tileLayerRef.current) {
                    map.removeLayer(tileLayerRef.current);
                }
                tileLayerRef.current = L.tileLayer(TILES[next].url, {
                    attribution: TILES[next].attribution,
                    maxZoom: MAX_ZOOM,
                }).addTo(map);

                // Re-render markers with new theme colors
                placeMarkers(usersRef.current, next);
            }

            return next;
        });
    }, [placeMarkers]);

    // ========================================================================
    // INITIALIZE MAP
    // ========================================================================

    useEffect(() => {
        if (!mapContainerRef.current || mapInstanceRef.current) return;

        const map = L.map(mapContainerRef.current, {
            center: DEFAULT_CENTER,
            zoom: DEFAULT_ZOOM,
            minZoom: MIN_ZOOM,
            maxZoom: MAX_ZOOM,
            zoomControl: true,
        });

        tileLayerRef.current = L.tileLayer(TILES.dark.url, {
            attribution: TILES.dark.attribution,
            maxZoom: MAX_ZOOM,
        }).addTo(map);

        mapInstanceRef.current = map;

        // Wait for the map to be fully ready before placing markers
        map.whenReady(() => {
            mapReadyRef.current = true;
            setIsLoading(false);
            fetchAndPlaceMarkers("dark");
        });

        return () => {
            mapReadyRef.current = false;
            map.remove();
            mapInstanceRef.current = null;
            tileLayerRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Auto-refresh markers every 60s
    useEffect(() => {
        const interval = setInterval(() => fetchAndPlaceMarkers(), 60_000);
        return () => clearInterval(interval);
    }, [fetchAndPlaceMarkers]);

    // ========================================================================
    // RENDER
    // ========================================================================

    return (
        <section
            className={`feature1-map ${theme === "light" ? "feature1-map--light" : ""}`}
            id="feature1-map"
        >
            {/* Map overlay badge */}
            <div className="feature1-map-overlay">
                <div className="pulse-dot" />
                <span>Daily Activity</span>
            </div>

            {/* Theme toggle button */}
            <button
                className="map-theme-toggle"
                onClick={toggleTheme}
                aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
                {theme === "dark" ? "☀️" : "🌙"}
            </button>

            {/* Loading spinner */}
            {isLoading && (
                <div className="map-loading">
                    <div className="map-loading-spinner" />
                    <span>Loading map…</span>
                </div>
            )}

            {/* Leaflet map container */}
            <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />
        </section>
    );
}
