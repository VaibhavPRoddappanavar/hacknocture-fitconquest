"use client";

import Link from "next/link";
import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { Footprints, Bike, Flame, Trophy, Timer, Play, Square, MapPin } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import * as turf from "@turf/turf";

// ============================================================================
// TYPES
// ============================================================================

interface ActivityUser {
  _id: string;
  username: string;
}

interface Activity {
  _id: string;
  userId: ActivityUser;
  activityType: "walk" | "cycle";
  source: string;
  distanceMeters: number;
  durationSeconds: number;
  avgSpeed: number;
  areaSquareMeters: number;
  startTime: string;
  endTime: string;
  route: {
    type: "LineString" | "Polygon";
    coordinates: any; // LineString: [lng,lat][]  |  Polygon: [lng,lat][][]
  };
}

type ActivityFilter = "walk" | "cycle";

interface SearchSuggestion {
  id: number;
  label: string;
  primary: string;
  secondary: string;
  latitude: number;
  longitude: number;
}

type ShieldType = "bronze" | "silver" | "gold";

interface ShieldCatalogItem {
  type: ShieldType;
  name: string;
  cost: number;
  days: number;
  color: string;
  desc: string;
}

interface ShieldRegion {
  id: string;
  name: string;
  owner: string;
  ownerId: string;
  shieldType: ShieldType;
  activatedAt: Date;
  expiresAt: Date;
  shield: ShieldCatalogItem;
  route: {
    type: 'Polygon';
    coordinates: [number, number][][];
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
const DEFAULT_CENTER = { lat: 12.9716, lng: 77.5946 };
const DEFAULT_ZOOM = 12;
const MIN_ZOOM = 10;
const MAX_ZOOM = 19;
const SEARCH_DELAY_MS = 400;
const TILE_LAYER_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const BANGALORE_BOUNDING_BOX = {
  north: 13.2, south: 12.7, west: 77.3, east: 77.85,
};

const USER_COLORS = [
  "#f43f5e", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6",
  "#06b6d4", "#ec4899", "#84cc16", "#ef4444", "#14b8a6",
  "#f97316", "#6366f1", "#22d3ee", "#a855f7", "#eab308",
  "#0ea5e9", "#d946ef", "#2dd4bf", "#fb923c", "#818cf8",
];

const SHIELDS: ShieldCatalogItem[] = [
  { type: "bronze", name: "Bronze Shield", cost: 100, days: 1, color: "#cd7f32", desc: "Secure your captured territories for 24 hours." },
  { type: "silver", name: "Silver Shield", cost: 250, days: 3, color: "#C0C0C0", desc: "Extended protection for your zones over a long weekend." },
  { type: "gold", name: "Gold Shield", cost: 400, days: 5, color: "#FFD700", desc: "Premium impenetrable defense for almost an entire week." },
];

const SHIELD_BY_TYPE = SHIELDS.reduce((acc, item) => {
  acc[item.type] = item;
  return acc;
}, {} as Record<ShieldType, ShieldCatalogItem>);

// ============================================================================
// HELPERS
// ============================================================================

function getUserColor(userId: string, map: Map<string, string>): string {
  if (map.has(userId)) return map.get(userId)!;
  const color = USER_COLORS[map.size % USER_COLORS.length];
  map.set(userId, color);
  return color;
}

function fmtDist(m: number) { return (m / 1000).toFixed(1) + " km"; }
function fmtDur(s: number) { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h > 0 ? `${h}h ${m}m` : `${m} min`; }
function fmtSpeed(k: number) { return k.toFixed(1) + " km/h"; }
function fmtArea(sqm: number) {
  if (sqm >= 1_000_000) return (sqm / 1_000_000).toFixed(2) + " km²";
  if (sqm > 0) return sqm.toLocaleString("en-IN") + " m²";
  return "—";
}

function actIcon(type: string) { return type === "walk" ? "🚶" : type === "cycle" ? "🚴" : "🏅"; }
function routeLabel(type: string) { return type === "Polygon" ? "Loop" : "A → B"; }

function getConquestStrength(activity: Activity, maxArea: number, maxDistance: number): number {
  const areaPart = (activity.areaSquareMeters || 0) / maxArea;
  const distancePart = (activity.distanceMeters || 0) / maxDistance;
  // Favor area ownership, but reward long routes too.
  return areaPart * 0.7 + distancePart * 0.3;
}

function getDayBounds(now: Date) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { start, end };
}

function getSecondsUntilDayEnd(now: Date) {
  const { end } = getDayBounds(now);
  return Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000));
}

function fmtCountdown(totalSeconds: number) {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return [hrs, mins, secs].map((n) => String(n).padStart(2, "0")).join(":");
}

function getShieldEmoji(shieldType: ShieldType) {
  if (shieldType === "gold") return "🥇";
  if (shieldType === "silver") return "🥈";
  return "🥉";
}

function getShieldVibrantColor(shieldType: ShieldType) {
  if (shieldType === "gold") return "#FFD700";
  if (shieldType === "silver") return "#D9D9D9";
  return "#CD7F32";
}

function getTopShieldRegionsFromActivities(activities: Activity[], now: Date): ShieldRegion[] {
  const polygonActivities = activities.filter((activity) => activity.route?.type === "Polygon");
  if (polygonActivities.length === 0) return [];

  const perUser = new Map<string, {
    ownerId: string;
    owner: string;
    totalArea: number;
    totalDistance: number;
    bestPolygon: Activity;
  }>();

  polygonActivities.forEach((activity) => {
    const ownerId = (typeof activity.userId === "string" ? activity.userId : activity.userId?._id) as string;
    if (!ownerId) return;

    const owner = (typeof activity.userId === "object" ? activity.userId?.username : `User ${ownerId.slice(-4)}`) || "Unknown";
    const existing = perUser.get(ownerId);
    const isBetterPolygon = !existing || (activity.areaSquareMeters || 0) > (existing.bestPolygon.areaSquareMeters || 0);

    if (!existing) {
      perUser.set(ownerId, {
        ownerId,
        owner,
        totalArea: activity.areaSquareMeters || 0,
        totalDistance: activity.distanceMeters || 0,
        bestPolygon: activity,
      });
      return;
    }

    existing.totalArea += activity.areaSquareMeters || 0;
    existing.totalDistance += activity.distanceMeters || 0;
    if (isBetterPolygon) {
      existing.bestPolygon = activity;
    }
  });

  const rankedUsers = Array.from(perUser.values())
    .sort((a, b) => {
      const scoreA = a.totalArea * 0.7 + a.totalDistance * 0.3;
      const scoreB = b.totalArea * 0.7 + b.totalDistance * 0.3;
      return scoreB - scoreA;
    })
    .slice(0, 3);

  const rankShieldTypes: ShieldType[] = ["gold", "silver", "bronze"];

  return rankedUsers.map((entry, rankIndex) => {
    const shieldType = rankShieldTypes[rankIndex];
    const shield = SHIELD_BY_TYPE[shieldType];
    const bestPolygon = entry.bestPolygon;
    const activatedAt = new Date(bestPolygon.endTime || bestPolygon.startTime || now);
    const expiresAt = new Date(activatedAt.getTime() + shield.days * 24 * 60 * 60 * 1000);

    return {
      id: `shield-${shieldType}-${entry.ownerId}`,
      name: `${entry.owner}'s Territory`,
      owner: entry.owner,
      ownerId: entry.ownerId,
      shieldType,
      activatedAt,
      expiresAt,
      shield,
      route: {
        type: 'Polygon' as 'Polygon',
        coordinates: bestPolygon.route.coordinates as [number, number][][],
      },
    };
  }).filter((region) => region.expiresAt > now);
}

function keepLargestPolygonChunk(geometry: any): any {
  if (!geometry || geometry.type !== "MultiPolygon") return geometry;

  const [largest] = [...geometry.coordinates].sort((a: any, b: any) => {
    const areaB = turf.area(turf.polygon(b));
    const areaA = turf.area(turf.polygon(a));
    return areaB - areaA;
  });

  if (!largest) return null;
  return { type: "Polygon", coordinates: largest };
}

// Logic to resolve overlaps with combined area+distance priority.
function resolveConquest(activities: Activity[], protectedZones: any): (Activity & { displayRoute?: any })[] {
  const polygonActivities = activities.filter((a) => a.route.type === "Polygon");
  const maxArea = Math.max(...polygonActivities.map((a) => a.areaSquareMeters || 0), 1);
  const maxDistance = Math.max(...polygonActivities.map((a) => a.distanceMeters || 0), 1);

  // Stronger polygon gets full claim; weaker one keeps only non-overlap remainder.
  const sorted = [...activities].sort((a, b) => {
    const aPoly = a.route.type === "Polygon";
    const bPoly = b.route.type === "Polygon";
    if (aPoly && !bPoly) return -1;
    if (!aPoly && bPoly) return 1;
    if (!aPoly && !bPoly) return 0;

    const scoreDiff = getConquestStrength(b, maxArea, maxDistance) - getConquestStrength(a, maxArea, maxDistance);
    if (Math.abs(scoreDiff) > 1e-9) return scoreDiff;

    const areaDiff = (b.areaSquareMeters || 0) - (a.areaSquareMeters || 0);
    if (areaDiff !== 0) return areaDiff;

    const distanceDiff = (b.distanceMeters || 0) - (a.distanceMeters || 0);
    if (distanceDiff !== 0) return distanceDiff;

    return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
  });
  
  const results: (Activity & { displayRoute?: any })[] = [];
  let combinedClaimed: any = null;

  sorted.forEach((activity) => {
    if (activity.route.type !== "Polygon") {
      results.push(activity);
      return;
    }

    try {
      const currentPoly = turf.polygon(activity.route.coordinates);
      let availableToClaim: any = currentPoly;

      if (protectedZones) {
        const protectedDiff = turf.difference(turf.featureCollection([currentPoly, protectedZones]));
        if (protectedDiff && (protectedDiff.geometry.type === "Polygon" || protectedDiff.geometry.type === "MultiPolygon")) {
          availableToClaim = turf.feature(protectedDiff.geometry);
        } else {
          availableToClaim = null;
        }
      }

      if (!availableToClaim) {
        results.push({ ...activity, displayRoute: null });
        return;
      }
      
      if (!combinedClaimed) {
        results.push({ ...activity, displayRoute: availableToClaim.geometry });
        combinedClaimed = availableToClaim;
      } else {
        // Find the difference: Current - CombinedClaimed
        const diff = turf.difference(turf.featureCollection([availableToClaim, combinedClaimed]));
        
        if (diff && diff.geometry) {
          const displayRoute = keepLargestPolygonChunk(diff.geometry);

          if (displayRoute) {
            results.push({ ...activity, displayRoute });
          } else {
            results.push({ ...activity, displayRoute: null });
          }

          combinedClaimed = turf.union(turf.featureCollection([combinedClaimed, availableToClaim]));
        } else {
          // Completely conquered!
          results.push({ ...activity, displayRoute: null });
        }
      }
    } catch (e) {
      console.warn("Turf operation failed for activity", activity._id, e);
      results.push({ ...activity, displayRoute: activity.route });
    }
  });

  return results;
}

function fmtDate(d: string) {
  const dt = new Date(d), now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  const diff = (today.getTime() - day.getTime()) / 86400000;
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function hexToRgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function getUserInitials(name: string) {
  const parts = (name || "Unknown").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function MapView() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.Layer[]>([]);
  const searchMarkerRef = useRef<L.Marker | null>(null);
  const mapReadyRef = useRef(false);
  const searchTimerRef = useRef<number | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const userColorMapRef = useRef<Map<string, string>>(new Map());
  const lastConquestModeRef = useRef(false);
  const trackerLayerRef = useRef<L.LayerGroup | null>(null);
  const trackerWatchIdRef = useRef<number | null>(null);
  const trackingStartMsRef = useRef<number | null>(null);
  const trackingCoordsRef = useRef<[number, number][]>([]);
  const trackingDistanceRef = useRef(0);
  const trackingLastPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const trackingTickerRef = useRef<number | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [filter, setFilter] = useState<ActivityFilter>("walk");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchSuggestions, setSearchSuggestions] = useState<SearchSuggestion[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [isConquestMode, setIsConquestMode] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [trackingActivityType, setTrackingActivityType] = useState<ActivityFilter>("walk");
  const [isTracking, setIsTracking] = useState(false);
  const [trackingDistanceMeters, setTrackingDistanceMeters] = useState(0);
  const [trackingDurationSeconds, setTrackingDurationSeconds] = useState(0);
  const [trackerStatus, setTrackerStatus] = useState("Choose mode above and press Start");

  const resetTrackingRuntime = useCallback(() => {
    trackingStartMsRef.current = null;
    trackingCoordsRef.current = [];
    trackingDistanceRef.current = 0;
    trackingLastPosRef.current = null;
    setTrackingDistanceMeters(0);
    setTrackingDurationSeconds(0);
  }, []);

  const stopTrackingWatcher = useCallback(() => {
    if (trackerWatchIdRef.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(trackerWatchIdRef.current);
    }
    trackerWatchIdRef.current = null;

    if (trackingTickerRef.current !== null) {
      window.clearInterval(trackingTickerRef.current);
      trackingTickerRef.current = null;
    }
  }, []);

  const drawTrackingPreview = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReadyRef.current) return;

    if (!trackerLayerRef.current) {
      trackerLayerRef.current = L.layerGroup().addTo(map);
    }

    trackerLayerRef.current.clearLayers();
    const coords = trackingCoordsRef.current;
    if (!coords.length) return;

    const latLngs = coords.map(([lng, lat]) => [lat, lng] as [number, number]);
    const color = trackingActivityType === "walk" ? "#22c55e" : "#06b6d4";

    L.polyline(latLngs, {
      color,
      weight: 5,
      opacity: 0.95,
      lineCap: "round",
      lineJoin: "round",
      dashArray: trackingActivityType === "cycle" ? "10 6" : undefined,
    }).addTo(trackerLayerRef.current);

    L.circleMarker(latLngs[0], {
      radius: 6,
      color: "#fff",
      fillColor: color,
      fillOpacity: 1,
      weight: 2,
    }).addTo(trackerLayerRef.current);

    const end = latLngs[latLngs.length - 1];
    L.circleMarker(end, {
      radius: 7,
      color,
      fillColor: "#fff",
      fillOpacity: 1,
      weight: 2,
    }).addTo(trackerLayerRef.current);
  }, [trackingActivityType]);

  const startTracking = useCallback(() => {
    if (isTracking) return;

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setTrackerStatus("Geolocation is not supported in this browser");
      return;
    }

    const mode = filter;
    setTrackingActivityType(mode);
    stopTrackingWatcher();
    resetTrackingRuntime();
    setTrackerStatus(`Waiting for GPS signal (${mode})...`);

    trackingStartMsRef.current = Date.now();
    setIsTracking(true);

    trackingTickerRef.current = window.setInterval(() => {
      if (!trackingStartMsRef.current) return;
      const elapsed = Math.floor((Date.now() - trackingStartMsRef.current) / 1000);
      setTrackingDurationSeconds(elapsed);
    }, 1000);

    trackerWatchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        const last = trackingLastPosRef.current;
        if (last) {
          const segment = turf.distance([last.lng, last.lat], [lng, lat], { units: "kilometers" }) * 1000;
          if (Number.isFinite(segment) && segment > 0) {
            trackingDistanceRef.current += segment;
          }
        }

        trackingLastPosRef.current = { lat, lng };
        trackingCoordsRef.current.push([lng, lat]);
        setTrackingDistanceMeters(trackingDistanceRef.current);
        setTrackerStatus(`Tracking ${mode}...`);
        drawTrackingPreview();
      },
      (err) => {
        setTrackerStatus(err.message || "Unable to read GPS location");
        setIsTracking(false);
        stopTrackingWatcher();
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    );
  }, [drawTrackingPreview, filter, isTracking, resetTrackingRuntime, stopTrackingWatcher]);

  const stopAndSaveTracking = useCallback(async () => {
    if (!isTracking) return;

    setIsTracking(false);
    stopTrackingWatcher();

    const token = localStorage.getItem("fit_token");
    if (!token) {
      setTrackerStatus("Login expired. Please login again.");
      return;
    }

    const startedAt = trackingStartMsRef.current;
    const coords = [...trackingCoordsRef.current];
    const endedAt = Date.now();

    if (!startedAt || coords.length < 2) {
      setTrackerStatus("Track is too short. Move a bit more before stopping.");
      resetTrackingRuntime();
      drawTrackingPreview();
      return;
    }

    try {
      setTrackerStatus("Saving activity...");

      const res = await fetch(`${API_URL}/api/activities`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({
          activityType: trackingActivityType,
          startTime: new Date(startedAt).toISOString(),
          endTime: new Date(endedAt).toISOString(),
          route: {
            type: "LineString",
            coordinates: coords,
          },
        }),
      });

      const out = await res.json();
      if (!res.ok) {
        throw new Error(out?.error || "Failed to save activity");
      }

      setActivities((prev) => [out as Activity, ...prev]);
      setTrackerStatus("Activity saved successfully");
      resetTrackingRuntime();
      drawTrackingPreview();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save activity";
      setTrackerStatus(msg);
    }
  }, [drawTrackingPreview, isTracking, resetTrackingRuntime, stopTrackingWatcher, trackingActivityType]);

  // ========================================================================
  // FETCH
  // ========================================================================

  useEffect(() => {
    (async () => {
      try {
        console.log("Fetching activities from:", `${API_URL}/api/activities?days=3`);
        const res = await fetch(`${API_URL}/api/activities?days=3`, {
          headers: { "ngrok-skip-browser-warning": "true" },
        });
        if (res.ok) {
          const data = await res.json();
          console.log("Fetched activities count:", data.length);
          setActivities(data);
        } else {
          console.error("Failed to fetch activities:", res.status);
        }
      } catch (e) { console.error("Fetch error:", e); }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("fit_token");
        if (!token) return;

        const res = await fetch(`${API_URL}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "ngrok-skip-browser-warning": "true",
          },
        });
        if (!res.ok) return;

        const user = await res.json();
        const uid = typeof user?._id === "string" ? user._id : typeof user?.id === "string" ? user.id : null;
        setCurrentUserId(uid);
      } catch (e) {
        console.error("Failed to resolve current user", e);
      }
    })();
  }, []);

  // ========================================================================
  // FILTERED
  // ========================================================================

  const filtered = useMemo(() => {
    return activities.filter((a) => a.activityType === filter);
  }, [activities, filter]);

  const activeShieldRegions = useMemo(() => {
    if (!isConquestMode) return [] as ShieldRegion[];
    const now = new Date();
    return getTopShieldRegionsFromActivities(filtered, now);
  }, [filtered, isConquestMode]);

  const shieldProtectedUnion = useMemo(() => {
    if (!isConquestMode) return null;
    if (activeShieldRegions.length === 0) return null;
    let merged: any = null;
    for (const region of activeShieldRegions) {
      const current = turf.polygon(region.route.coordinates);
      if (!merged) {
        merged = current;
      } else {
        const unioned = turf.union(turf.featureCollection([merged, current]));
        if (unioned && (unioned.geometry.type === "Polygon" || unioned.geometry.type === "MultiPolygon")) {
          merged = unioned;
        }
      }
    }
    return merged;
  }, [activeShieldRegions, isConquestMode]);

  // Legend: sorted by total area (loops count), lines show count
  const userLegend = useMemo(() => {
    const m = new Map<string, { username: string; color: string; loops: number; lines: number; totalArea: number }>();
    filtered.forEach((a) => {
      const uid = (typeof a.userId === "string" ? a.userId : a.userId?._id) as string;
      const username = (typeof a.userId === "object" ? a.userId?.username : "User " + uid.slice(-4)) || "Unknown";
      
      if (!uid) return;
      const color = getUserColor(uid, userColorMapRef.current);
      if (!m.has(uid)) m.set(uid, { username, color, loops: 0, lines: 0, totalArea: 0 });
      const entry = m.get(uid)!;
      if (a.route.type === "Polygon") { entry.loops++; entry.totalArea += a.areaSquareMeters || 0; }
      else { entry.lines++; }
    });
    return Array.from(m.values()).sort((a, b) => b.totalArea - a.totalArea);
  }, [filtered]);

  // ========================================================================
  // DRAW — handle LineString vs Polygon differently
  // ========================================================================

  const drawActivities = useCallback((preserveViewport = false) => {
    const map = mapInstanceRef.current;
    if (!map || !mapReadyRef.current) return;
    const conquestToggled = lastConquestModeRef.current !== isConquestMode;
    const zoom = map.getZoom();

    // Clear
    layersRef.current.forEach((l) => { try { map.removeLayer(l); } catch {} });
    layersRef.current = [];
    if (filtered.length === 0) return;

    const allLatLngs: [number, number][] = [];
    const userBadges = new Map<string, {
      uid: string;
      username: string;
      color: string;
      isCurrent: boolean;
      score: number;
      latLng: [number, number];
    }>();

    // Apply Conquest logic if enabled
    const displayActivities = isConquestMode ? resolveConquest(filtered, shieldProtectedUnion) : filtered;

    const updateUserBadge = (
      uid: string,
      username: string,
      color: string,
      latLng: [number, number],
      score: number,
      isCurrent: boolean,
    ) => {
      const existing = userBadges.get(uid);
      if (!existing || score > existing.score) {
        userBadges.set(uid, { uid, username, color, score, latLng, isCurrent });
      }
    };

    displayActivities.forEach((activity) => {
      const uid = (typeof activity.userId === "string" ? activity.userId : activity.userId?._id) as string;
      const username = (typeof activity.userId === "object" ? activity.userId?.username : "User " + uid?.slice(-4)) || "Unknown";
      
      if (!uid) return;
      const color = getUserColor(uid, userColorMapRef.current);
      const isCurrentUser = !!currentUserId && uid === currentUserId;
      const isLoop = activity.route?.type === "Polygon";
      
      // Skip if completely conquered in Conquest Mode
      if (isConquestMode && isLoop && !(activity as any).displayRoute) return;

      // Build tooltip/popup HTML
      const areaRow = isLoop
        ? `<div style="text-align:center;">
             <div style="font-size:0.95rem;font-weight:700;color:${color};">${fmtArea(activity.areaSquareMeters)}</div>
             <div style="font-size:0.6rem;color:#777;text-transform:uppercase;">area covered</div>
           </div>`
        : "";

      const popupHTML = `
        <div style="padding:8px 4px;min-width:200px;font-family:system-ui,sans-serif;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
            <span style="font-size:1.5rem;">${actIcon(activity.activityType)}</span>
            <div>
              <div style="font-size:0.95rem;font-weight:700;color:#111;">${username}${isCurrentUser ? ' (You)' : ''} ${isConquestMode ? '(Conqueror)' : ''}</div>
              <div style="font-size:0.72rem;color:#666;">
                ${fmtDate(activity.startTime)} • ${activity.activityType}
                <span style="margin-left:6px;padding:2px 6px;background:#eee;color:#444;border-radius:4px;font-size:0.62rem;font-weight:700;">
                  ${routeLabel(activity.route.type)}
                </span>
              </div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:${isLoop ? "1fr 1fr" : "1fr 1fr 1fr"};gap:8px;padding:10px 0;border-top:1px solid #eaeaea;">
            ${areaRow}
            <div style="text-align:center;">
              <div style="font-size:0.95rem;font-weight:700;color:${color};">${fmtDist(activity.distanceMeters)}</div>
              <div style="font-size:0.6rem;color:#777;text-transform:uppercase;">distance</div>
            </div>
            <div style="text-align:center;">
              <div style="font-size:0.95rem;font-weight:700;color:${color};">${fmtDur(activity.durationSeconds)}</div>
              <div style="font-size:0.6rem;color:#777;text-transform:uppercase;">duration</div>
            </div>
            <div style="text-align:center;">
              <div style="font-size:0.95rem;font-weight:700;color:${color};">${fmtSpeed(activity.avgSpeed)}</div>
              <div style="font-size:0.6rem;color:#777;text-transform:uppercase;">avg speed</div>
            </div>
          </div>
          <div style="font-size:0.7rem;padding:4px 8px;margin-top:6px;background:#f5f5f5;border-radius:6px;color:#555;text-align:center;">
            Source: ${activity.source}
          </div>
        </div>`;

      if (isLoop) {
        // ── POLYGON (loop route) → filled region ──────────────────────
        const displayGeo = (activity as any).displayRoute || activity.route;
        
        let polygon: L.Layer;
        if (displayGeo.type === "MultiPolygon") {
          const latLngs = displayGeo.coordinates.map((poly: any) => 
            poly[0].map(([lng, lat]: any) => [lat, lng])
          );

          try {
            const centroid = turf.centroid(turf.multiPolygon(displayGeo.coordinates)).geometry.coordinates;
            updateUserBadge(
              uid,
              username,
              color,
              [centroid[1], centroid[0]],
              (activity.areaSquareMeters || 0) + (activity.distanceMeters || 0),
              isCurrentUser,
            );
          } catch {}

          polygon = L.polygon(latLngs, {
            color,
            weight: isCurrentUser ? 3.8 : 2.5,
            opacity: isCurrentUser ? 1 : 0.9,
            fillColor: color,
            fillOpacity: isCurrentUser ? 0.5 : 0.35,
            smoothFactor: 1,
          }).addTo(map);
          latLngs.flat().forEach((ll: any) => allLatLngs.push(ll as [number, number]));
        } else {
          const ring: [number, number][] = displayGeo.coordinates[0];
          if (!ring || ring.length < 4) return;
          const latLngs = ring.map(([lng, lat]) => [lat, lng] as [number, number]);
          latLngs.forEach((ll) => allLatLngs.push(ll));

          try {
            const centroid = turf.centroid(turf.polygon(displayGeo.coordinates)).geometry.coordinates;
            updateUserBadge(
              uid,
              username,
              color,
              [centroid[1], centroid[0]],
              (activity.areaSquareMeters || 0) + (activity.distanceMeters || 0),
              isCurrentUser,
            );
          } catch {}

          polygon = L.polygon(latLngs, {
            color,
            weight: isCurrentUser ? 3.8 : 2.5,
            opacity: isCurrentUser ? 1 : 0.9,
            fillColor: color,
            fillOpacity: isCurrentUser ? 0.5 : 0.35,
            smoothFactor: 1,
          }).addTo(map);
        }

        polygon.bindPopup(popupHTML, { maxWidth: 300, className: "fitness-popup" });
        polygon.on("mouseover", () => (polygon as L.Polygon).setStyle({ fillOpacity: isCurrentUser ? 0.62 : 0.5, weight: isCurrentUser ? 4.6 : 3.5 }));
        polygon.on("mouseout", () => (polygon as L.Polygon).setStyle({ fillOpacity: isCurrentUser ? 0.5 : 0.35, weight: isCurrentUser ? 3.8 : 2.5 }));
        polygon.on("click", () => setSelectedActivity(activity));
        layersRef.current.push(polygon);
      } else {
        // ── LINESTRING (A→B route) → thick colored path ───────────────
        const coords: [number, number][] = activity.route.coordinates;
        if (!coords || coords.length < 2) return;
        const latLngs = coords.map(([lng, lat]) => [lat, lng] as [number, number]);
        latLngs.forEach((ll) => allLatLngs.push(ll));
        const mid = latLngs[Math.floor(latLngs.length / 2)];
        if (mid) {
          updateUserBadge(uid, username, color, mid, activity.distanceMeters || 0, isCurrentUser);
        }

        // Outer glow line
        const glow = L.polyline(latLngs, {
          color,
          weight: isCurrentUser ? 14 : 10,
          opacity: isCurrentUser ? 0.3 : 0.15,
          lineCap: "round",
          lineJoin: "round",
          smoothFactor: 1.5,
        }).addTo(map);

        // Main line
        const line = L.polyline(latLngs, {
          color,
          weight: isCurrentUser ? 5.5 : 4,
          opacity: isCurrentUser ? 1 : 0.85,
          lineCap: "round",
          lineJoin: "round",
          smoothFactor: 1.5,
          dashArray: activity.activityType === "walk" ? undefined : "10 6",
        }).addTo(map);

        line.bindPopup(popupHTML, { maxWidth: 300, className: "fitness-popup" });
        line.on("mouseover", () => { line.setStyle({ weight: 6, opacity: 1 }); glow.setStyle({ weight: 16, opacity: 0.25 }); });
        line.on("mouseout", () => { line.setStyle({ weight: 4, opacity: 0.85 }); glow.setStyle({ weight: 10, opacity: 0.15 }); });
        line.on("click", () => setSelectedActivity(activity));

        // Start/end markers
        const startDot = L.circleMarker(latLngs[0], {
          radius: 6, color: "#fff", fillColor: color, fillOpacity: 1, weight: 2,
        }).addTo(map);

        const endDot = L.circleMarker(latLngs[latLngs.length - 1], {
          radius: 5, color, fillColor: "#fff", fillOpacity: 1, weight: 2,
        }).addTo(map);

        layersRef.current.push(glow, line, startDot, endDot);
      }
    });

    if (isConquestMode) {
      activeShieldRegions.forEach((region) => {
        const latLngs = region.route.coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number]);
        latLngs.forEach((ll) => allLatLngs.push(ll));

        const shieldEmoji = getShieldEmoji(region.shieldType);
        const shieldColor = getShieldVibrantColor(region.shieldType);

        const shieldPolygon = L.polygon(latLngs, {
          color: shieldColor,
          weight: 5,
          opacity: 1,
          fillColor: shieldColor,
          fillOpacity: 0.3,
          dashArray: "12 8",
        }).addTo(map);

        const shieldGlow = L.polygon(latLngs, {
          color: shieldColor,
          weight: 10,
          opacity: 0.35,
          fillOpacity: 0,
        }).addTo(map);

        const ttlSeconds = Math.max(0, Math.floor((region.expiresAt.getTime() - Date.now()) / 1000));
        const ttlLabel = ttlSeconds > 0 ? fmtCountdown(ttlSeconds) : "00:00:00";

        shieldPolygon.bindPopup(
          `
          <div style="padding:8px 6px;min-width:220px;font-family:system-ui,sans-serif;">
            <div style="font-size:0.95rem;font-weight:800;color:${shieldColor};margin-bottom:4px;">${shieldEmoji} ${region.shield.name}</div>
            <div style="font-size:0.8rem;color:#333;font-weight:700;">${region.name}</div>
            <div style="font-size:0.72rem;color:#666;margin-top:2px;">Owner: ${region.owner}</div>
            <div style="font-size:0.72rem;color:#666;">Duration: ${region.shield.days} day${region.shield.days > 1 ? "s" : ""}</div>
            <div style="margin-top:8px;padding:5px 8px;border-radius:7px;background:#f3f4f6;font-size:0.7rem;font-weight:700;color:#374151;">⏳ Expires in ${ttlLabel}</div>
          </div>
        `,
          { maxWidth: 280, className: "fitness-popup" },
        );

        shieldPolygon.on("mouseover", () => {
          shieldPolygon.setStyle({ fillOpacity: 0.42, weight: 6 });
          shieldGlow.setStyle({ opacity: 0.5, weight: 12 });
        });

        shieldPolygon.on("mouseout", () => {
          shieldPolygon.setStyle({ fillOpacity: 0.3, weight: 5 });
          shieldGlow.setStyle({ opacity: 0.35, weight: 10 });
        });

        layersRef.current.push(shieldGlow);
        layersRef.current.push(shieldPolygon);

        // Floating badge at centroid
        try {
          const centroid = turf.centroid(turf.polygon(region.route.coordinates)).geometry.coordinates;
          const badgeMarker = L.marker([centroid[1], centroid[0]], {
            icon: L.divIcon({
              className: "shield-tier-badge",
              iconSize: [38, 38],
              iconAnchor: [19, 19],
              html: `<div style="
                width:38px;height:38px;display:flex;align-items:center;justify-content:center;
                border-radius:50%;background:${shieldColor};box-shadow:0 0 12px ${shieldColor}66;
                font-size:2rem;font-weight:900;letter-spacing:0.02em;">
                ${shieldEmoji}
              </div>`
            }),
            keyboard: false,
          }).addTo(map);
          layersRef.current.push(badgeMarker);
        } catch {}
      });
    }

    const orderedBadges = Array.from(userBadges.values()).sort((a, b) => {
      if (a.isCurrent && !b.isCurrent) return -1;
      if (!a.isCurrent && b.isCurrent) return 1;
      return b.score - a.score;
    });

    const showName = zoom >= 12;
    const showFullName = zoom >= 14;
    const badgeAvatarSize = zoom >= 14 ? 26 : zoom >= 12 ? 24 : 20;
    const badgeFontSize = zoom >= 14 ? 11 : zoom >= 12 ? 10 : 0;
    const badgeNameMaxChars = showFullName ? 16 : 10;
    const placedRects: Array<{ x: number; y: number; w: number; h: number }> = [];

    const intersects = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => {
      const pad = 6;
      return !(
        a.x + a.w + pad < b.x ||
        b.x + b.w + pad < a.x ||
        a.y + a.h + pad < b.y ||
        b.y + b.h + pad < a.y
      );
    };

    const resolveBadgeLatLng = (
      baseLatLng: [number, number],
      boxW: number,
      boxH: number,
    ): [number, number] => {
      const basePoint = map.latLngToLayerPoint(baseLatLng);
      const candidates: Array<[number, number]> = [[0, 0]];

      for (let ring = 1; ring <= 4; ring++) {
        const r = ring * 22;
        for (let i = 0; i < 8; i++) {
          const angle = (Math.PI * 2 * i) / 8;
          candidates.push([Math.round(Math.cos(angle) * r), Math.round(Math.sin(angle) * r)]);
        }
      }

      for (const [dx, dy] of candidates) {
        const x = basePoint.x + dx - boxW / 2;
        const y = basePoint.y + dy - boxH;
        const rect = { x, y, w: boxW, h: boxH };
        const collides = placedRects.some((r) => intersects(rect, r));
        if (!collides) {
          placedRects.push(rect);
          const shifted = L.point(basePoint.x + dx, basePoint.y + dy);
          const shiftedLatLng = map.layerPointToLatLng(shifted);
          return [shiftedLatLng.lat, shiftedLatLng.lng];
        }
      }

      const fallbackRect = { x: basePoint.x - boxW / 2, y: basePoint.y - boxH, w: boxW, h: boxH };
      placedRects.push(fallbackRect);
      return baseLatLng;
    };

    orderedBadges.forEach((badge) => {
      const initials = getUserInitials(badge.username);
      const rawName = badge.username || "Unknown";
      const trimmedName = rawName.length > badgeNameMaxChars ? `${rawName.slice(0, badgeNameMaxChars - 1)}…` : rawName;
      const displayName = escapeHtml(trimmedName);
      const estimatedWidth = showName ? (badge.isCurrent ? 150 : 125) : badgeAvatarSize + 12;
      const estimatedHeight = showName ? 38 : badgeAvatarSize + 8;
      const markerLatLng = resolveBadgeLatLng(badge.latLng, estimatedWidth, estimatedHeight);

      const marker = L.marker(markerLatLng, {
        icon: L.divIcon({
          className: "",
          iconSize: [0, 0],
          iconAnchor: [0, 0],
          html: `
            <div style="
              transform: translate(-50%, -100%);
              pointer-events: none;
              display: inline-flex;
              align-items: center;
              gap: 8px;
              padding: ${showName ? "4px 9px 4px 4px" : "3px"};
              border-radius: 999px;
              border: 1px solid ${badge.isCurrent ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.35)"};
              background: ${badge.isCurrent ? "rgba(12,18,28,0.95)" : "rgba(12,18,28,0.78)"};
              box-shadow: ${badge.isCurrent ? `0 0 0 2px ${hexToRgba(badge.color, 0.45)}, 0 6px 18px rgba(0,0,0,0.32)` : "0 4px 12px rgba(0,0,0,0.28)"};
              backdrop-filter: blur(6px);
            ">
              <div style="
                width: ${badgeAvatarSize}px;
                height: ${badgeAvatarSize}px;
                border-radius: 50%;
                background: ${badge.color};
                color: #fff;
                display: grid;
                place-items: center;
                font-size: ${zoom >= 12 ? "11px" : "9px"};
                font-weight: 800;
                letter-spacing: 0.03em;
                border: 2px solid rgba(255,255,255,0.75);
              ">${escapeHtml(initials)}</div>
              ${showName
                ? `<div style="display:flex;align-items:center;gap:6px;max-width:150px;">
                    <span style="font-size:${badgeFontSize}px;color:#fff;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${displayName}</span>
                    ${badge.isCurrent ? '<span style="font-size:9px;font-weight:800;color:#0c1320;background:#7dd3fc;padding:1px 6px;border-radius:999px;letter-spacing:0.04em;">YOU</span>' : ""}
                  </div>`
                : `${badge.isCurrent ? '<span style="font-size:8px;font-weight:800;color:#0c1320;background:#7dd3fc;padding:1px 5px;border-radius:999px;letter-spacing:0.04em;">YOU</span>' : ""}`}
            </div>
          `,
        }),
        zIndexOffset: badge.isCurrent ? 1200 : 800,
        keyboard: false,
      }).addTo(map);
      layersRef.current.push(marker);
    });

    // Fit bounds
    if (allLatLngs.length > 0 && !conquestToggled && !preserveViewport) {
      console.log("Drawing", layersRef.current.length, "layers for", filtered.length, "activities");
      map.fitBounds(L.latLngBounds(allLatLngs), { padding: [40, 40], maxZoom: 14 });
    }

    lastConquestModeRef.current = isConquestMode;
  }, [filtered, isConquestMode, currentUserId, activeShieldRegions, shieldProtectedUnion]);

  // ========================================================================
  // SEARCH
  // ========================================================================

  const handleSelectSuggestion = useCallback((s: SearchSuggestion) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (searchMarkerRef.current) map.removeLayer(searchMarkerRef.current);
    map.flyTo([s.latitude, s.longitude], 14, { animate: true });
    searchMarkerRef.current = L.marker([s.latitude, s.longitude]).addTo(map);
    searchMarkerRef.current.bindPopup(`📍 ${s.label}`).openPopup();
    setSearchQuery(s.label);
    setSearchSuggestions([]);
  }, []);

  // ========================================================================
  // MAP INIT
  // ========================================================================

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;
    const map = L.map(mapContainerRef.current, {
      center: [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng],
      zoom: DEFAULT_ZOOM, minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM, zoomControl: true,
    });
    L.tileLayer(TILE_LAYER_URL, { attribution: TILE_ATTRIBUTION, maxZoom: MAX_ZOOM }).addTo(map);
    mapInstanceRef.current = map;
    map.whenReady(() => { mapReadyRef.current = true; setIsLoading(false); });
    return () => {
      mapReadyRef.current = false;
      if (searchMarkerRef.current) { map.removeLayer(searchMarkerRef.current); searchMarkerRef.current = null; }
      map.remove(); mapInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw when activities change or map is ready
  useEffect(() => { 
    if (mapReadyRef.current && activities.length > 0) {
      drawActivities(); 
    }
  }, [drawActivities, isConquestMode, activities, isLoading]);

  // Reflow badges while zooming without resetting viewport
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const onZoomEnd = () => {
      if (mapReadyRef.current && activities.length > 0) {
        drawActivities(true);
      }
    };

    map.on("zoomend", onZoomEnd);
    return () => {
      map.off("zoomend", onZoomEnd);
    };
  }, [drawActivities, activities.length]);

  // Search effect
  useEffect(() => {
    const q = searchQuery.trim();
    if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current);
    if (searchAbortRef.current) { searchAbortRef.current.abort("replaced"); searchAbortRef.current = null; }
    if (q.length < 2) { setSearchSuggestions([]); setSearchLoading(false); return; }
    searchTimerRef.current = window.setTimeout(async () => {
      const ctrl = new AbortController(); searchAbortRef.current = ctrl; setSearchLoading(true);
      try {
        const url = new URL("https://nominatim.openstreetmap.org/search");
        url.searchParams.set("format", "json"); url.searchParams.set("limit", "8");
        url.searchParams.set("accept-language", "en"); url.searchParams.set("countrycodes", "in"); url.searchParams.set("q", q);
        if (q.length <= 4) { url.searchParams.set("viewbox", `${BANGALORE_BOUNDING_BOX.west},${BANGALORE_BOUNDING_BOX.north},${BANGALORE_BOUNDING_BOX.east},${BANGALORE_BOUNDING_BOX.south}`); url.searchParams.set("bounded", "1"); }
        const res = await fetch(url.toString(), { signal: ctrl.signal, headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error("fail");
        const json = await res.json();
        setSearchSuggestions(Array.isArray(json)
          ? json.map((i: any) => { const lat = +i.lat, lng = +i.lon; if (!isFinite(lat) || !isFinite(lng)) return null; const [p, ...r] = (i.display_name || "").split(", "); return { id: i.place_id, label: p, primary: p, secondary: r.join(", "), latitude: lat, longitude: lng }; }).filter(Boolean) as SearchSuggestion[]
          : []);
      } catch (e) { if (e instanceof Error && e.name === "AbortError") return; setSearchSuggestions([]); } finally { setSearchLoading(false); }
    }, SEARCH_DELAY_MS);
    return () => { if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current); };
  }, [searchQuery]);

  useEffect(() => () => { if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current); if (searchAbortRef.current) searchAbortRef.current.abort("unmount"); }, []);

  useEffect(() => {
    return () => {
      stopTrackingWatcher();
      if (trackerLayerRef.current && mapInstanceRef.current) {
        try {
          mapInstanceRef.current.removeLayer(trackerLayerRef.current);
        } catch {}
      }
    };
  }, [stopTrackingWatcher]);

  // ========================================================================
  // RENDER
  // ========================================================================

  const loopCount = filtered.filter((a) => a.route.type === "Polygon").length;
  const lineCount = filtered.filter((a) => a.route.type === "LineString").length;

  const secondsToReset = getSecondsUntilDayEnd(new Date());

  return (
    <section className="map-fullscreen-shell" id="feature1-map">
      {/* ═══ FULLSCREEN MAP ═══ */}
      <div className="map-fullscreen-bg">
        {isLoading && <div className="map-loading"><div className="map-loading-spinner" /><span>Loading map…</span></div>}
        <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />
      </div>

      {/* ═══ TOP CENTER: GPS Tracker ═══ */}
      <div className="map-overlay-top-center">
        <div className="map-tracker-bar">
          <div className="map-tracker-bar-left">
            <span className="map-tracker-bar-title">GPS Tracker</span>
            <span className={`map-tracker-bar-chip ${isTracking ? "map-tracker-bar-chip--live" : ""}`}>
              {isTracking ? "REC" : "READY"}
            </span>
          </div>
          <div className="map-tracker-bar-metrics">
            <div className="map-tracker-bar-stat">
              <span className="map-tracker-bar-stat-val">{fmtDist(trackingDistanceMeters)}</span>
              <span className="map-tracker-bar-stat-label">Dist</span>
            </div>
            <div className="map-tracker-bar-divider" />
            <div className="map-tracker-bar-stat">
              <span className="map-tracker-bar-stat-val">{fmtDur(trackingDurationSeconds)}</span>
              <span className="map-tracker-bar-stat-label">Time</span>
            </div>
          </div>
          <div className="map-tracker-bar-actions">
            {!isTracking ? (
              <button type="button" onClick={startTracking} className="map-tracker-bar-btn map-tracker-bar-btn--start">
                <Play className="w-3 h-3" /> Start {filter}
              </button>
            ) : (
              <button type="button" onClick={stopAndSaveTracking} className="map-tracker-bar-btn map-tracker-bar-btn--stop">
                <Square className="w-3 h-3" /> Stop &amp; Save
              </button>
            )}
          </div>
        </div>
        {trackerStatus && <div className="map-tracker-bar-status">{trackerStatus}</div>}
      </div>

      {/* ═══ RIGHT SIDE: Controls Panel ═══ */}
      <div className="map-overlay-right">
        {/* Search */}
        <div className="map-right-search">
          <div className="map-right-search-box">
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search places…" aria-label="Search" />
            {searchQuery && <button type="button" className="map-search-clear" onClick={() => { setSearchQuery(""); setSearchSuggestions([]); }}>×</button>}
          </div>
          {(searchLoading || searchSuggestions.length > 0) && (
            <ul className="map-search-suggestions" role="listbox">
              {searchLoading && <li className="map-search-status">Searching…</li>}
              {!searchLoading && searchSuggestions.map((s) => (
                <li key={s.id}><button type="button" onClick={() => handleSelectSuggestion(s)}><span className="map-search-primary">{s.primary}</span>{s.secondary && <span className="map-search-secondary">{s.secondary}</span>}</button></li>
              ))}
            </ul>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="map-right-filters">
          {(["walk", "cycle"] as const).map((t) => (
            <button
              key={t}
              type="button"
              disabled={isTracking}
              className={`map-right-filter-btn ${filter === t ? "map-right-filter-btn--active" : ""}`}
              onClick={() => setFilter(t)}
            >
              {t === "walk" ? <><Footprints className="w-3.5 h-3.5 inline" /> Walk</> : <><Bike className="w-3.5 h-3.5 inline" /> Cycle</>}
            </button>
          ))}
        </div>

        {/* Conquest + Leaderboard + Badges */}
        <div className="map-right-actions">
          <button 
            className={`map-right-action-btn ${isConquestMode ? 'map-right-action-btn--active' : ''}`}
            onClick={() => setIsConquestMode(!isConquestMode)}
          >
            <Flame className="w-3.5 h-3.5 inline" /> {isConquestMode ? 'Exit Conquest' : 'Conquest'}
          </button>
          <Link className="map-right-action-btn" href="/feature1/leaderboard">
            <Trophy className="w-3.5 h-3.5 inline" /> Leaderboard
          </Link>
        </div>

        {isConquestMode && (
          <div className="map-right-countdown">
            <Timer className="w-3 h-3 inline" /> {fmtCountdown(secondsToReset)}
          </div>
        )}

        {/* Badge Counts */}
        <div className="map-right-badges">
          <div className="map-right-badge">
            <span className="map-right-badge-count">{loopCount}</span>
            <span className="map-right-badge-label">Regions</span>
          </div>
          <div className="map-right-badge">
            <span className="map-right-badge-count">{lineCount}</span>
            <span className="map-right-badge-label">Paths</span>
          </div>
        </div>

        {/* Map Label */}
        <div className="map-right-label">
          <div className="map-right-label-dot" />
          <span>{isConquestMode ? 'Conquest' : 'Activity Map'}</span>
        </div>
      </div>

      {/* ═══ BOTTOM LEFT: Legend ═══ */}
      {userLegend.length > 0 && (
        <div className="map-overlay-legend">
          <div className="map-legend-title">Users</div>
          {userLegend.map((u) => (
            <div key={u.username} className="map-legend-row">
              <div className="map-legend-swatch" style={{ background: hexToRgba(u.color, 0.3), borderColor: u.color }} />
              <span className="map-legend-name">{u.username}</span>
              <div className="map-legend-stats">
                {u.loops > 0 && <span style={{ color: u.color }}>{fmtArea(u.totalArea)}</span>}
                {u.lines > 0 && <span>{u.lines} path{u.lines > 1 ? "s" : ""}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ BOTTOM RIGHT: Detail Card ═══ */}
      {selectedActivity && (() => {
        const c = selectedActivity.userId?._id 
        ? getUserColor(selectedActivity.userId._id, userColorMapRef.current)
        : "#fff";
        const isLoop = selectedActivity.route.type === "Polygon";
        return (
          <div className="map-overlay-detail">
            <button className="map-detail-close" onClick={() => setSelectedActivity(null)}>×</button>
            <div className="map-detail-header">
              <span className="map-detail-icon">{actIcon(selectedActivity.activityType)}</span>
              <div>
                <div className="map-detail-user">{selectedActivity.userId?.username || "Unknown"}</div>
                <div className="map-detail-meta">
                  {fmtDate(selectedActivity.startTime)} • {selectedActivity.activityType}
                  <span className="map-detail-type-tag" style={{ color: isLoop ? c : undefined }}>
                    {routeLabel(selectedActivity.route.type)}
                  </span>
                </div>
              </div>
            </div>
            <div className="map-detail-grid">
              {isLoop && (
                <div className="map-detail-stat">
                  <div className="map-detail-stat-val" style={{ color: c }}>{fmtArea(selectedActivity.areaSquareMeters)}</div>
                  <div className="map-detail-stat-label">Area</div>
                </div>
              )}
              {[
                { label: "Distance", value: fmtDist(selectedActivity.distanceMeters) },
                { label: "Duration", value: fmtDur(selectedActivity.durationSeconds) },
                { label: "Avg Speed", value: fmtSpeed(selectedActivity.avgSpeed) },
              ].map((s) => (
                <div key={s.label} className="map-detail-stat">
                  <div className="map-detail-stat-val" style={{ color: c }}>{s.value}</div>
                  <div className="map-detail-stat-label">{s.label}</div>
                </div>
              ))}
            </div>
            <div className="map-detail-source">Source: {selectedActivity.source}</div>
          </div>
        );
      })()}
    </section>
  );
}
