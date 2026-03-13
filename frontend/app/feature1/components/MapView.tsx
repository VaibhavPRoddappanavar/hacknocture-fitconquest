"use client";

import Link from "next/link";
import { useEffect, useRef, useCallback, useState, useMemo } from "react";
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

type ActivityFilter = "all" | "walk" | "cycle";

interface SearchSuggestion {
  id: number;
  label: string;
  primary: string;
  secondary: string;
  latitude: number;
  longitude: number;
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

// Logic to resolve overlaps based on distance
function resolveConquest(activities: Activity[]): (Activity & { displayRoute?: any })[] {
  // 1. Sort by distance descending (strongest conquers first)
  const sorted = [...activities].sort((a, b) => b.distanceMeters - a.distanceMeters);
  
  const results: (Activity & { displayRoute?: any })[] = [];
  let combinedClaimed: any = null;

  sorted.forEach((activity) => {
    if (activity.route.type !== "Polygon") {
      results.push(activity);
      return;
    }

    try {
      const currentPoly = turf.polygon(activity.route.coordinates);
      
      if (!combinedClaimed) {
        results.push({ ...activity, displayRoute: activity.route });
        combinedClaimed = currentPoly;
      } else {
        // Find the difference: Current - CombinedClaimed
        const diff = turf.difference(turf.featureCollection([currentPoly, combinedClaimed]));
        
        if (diff) {
          results.push({ ...activity, displayRoute: diff.geometry });
          combinedClaimed = turf.union(turf.featureCollection([combinedClaimed, currentPoly]));
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

  const [isLoading, setIsLoading] = useState(true);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchSuggestions, setSearchSuggestions] = useState<SearchSuggestion[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [isConquestMode, setIsConquestMode] = useState(false);

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

  // ========================================================================
  // FILTERED
  // ========================================================================

  const filtered = useMemo(() => {
    if (filter === "all") return activities;
    return activities.filter((a) => a.activityType === filter);
  }, [activities, filter]);

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

  const drawActivities = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReadyRef.current) return;

    // Clear
    layersRef.current.forEach((l) => { try { map.removeLayer(l); } catch {} });
    layersRef.current = [];
    if (filtered.length === 0) return;

    const allLatLngs: [number, number][] = [];

    // Apply Conquest logic if enabled
    const displayActivities = isConquestMode ? resolveConquest(filtered) : filtered;

    displayActivities.forEach((activity) => {
      const uid = (typeof activity.userId === "string" ? activity.userId : activity.userId?._id) as string;
      const username = (typeof activity.userId === "object" ? activity.userId?.username : "User " + uid?.slice(-4)) || "Unknown";
      
      if (!uid) return;
      const color = getUserColor(uid, userColorMapRef.current);
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
              <div style="font-size:0.95rem;font-weight:700;color:#111;">${activity.userId.username} ${isConquestMode ? '(Conqueror)' : ''}</div>
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
          polygon = L.polygon(latLngs, {
            color, weight: 2.5, opacity: 0.9, fillColor: color, fillOpacity: 0.35, smoothFactor: 1,
          }).addTo(map);
          latLngs.flat().forEach((ll: any) => allLatLngs.push(ll as [number, number]));
        } else {
          const ring: [number, number][] = displayGeo.coordinates[0];
          if (!ring || ring.length < 4) return;
          const latLngs = ring.map(([lng, lat]) => [lat, lng] as [number, number]);
          latLngs.forEach((ll) => allLatLngs.push(ll));

          polygon = L.polygon(latLngs, {
            color, weight: 2.5, opacity: 0.9, fillColor: color, fillOpacity: 0.35, smoothFactor: 1,
          }).addTo(map);
        }

        polygon.bindPopup(popupHTML, { maxWidth: 300, className: "fitness-popup" });
        polygon.on("mouseover", () => (polygon as L.Polygon).setStyle({ fillOpacity: 0.5, weight: 3.5 }));
        polygon.on("mouseout", () => (polygon as L.Polygon).setStyle({ fillOpacity: 0.35, weight: 2.5 }));
        polygon.on("click", () => setSelectedActivity(activity));
        layersRef.current.push(polygon);
      } else {
        // ── LINESTRING (A→B route) → thick colored path ───────────────
        const coords: [number, number][] = activity.route.coordinates;
        if (!coords || coords.length < 2) return;
        const latLngs = coords.map(([lng, lat]) => [lat, lng] as [number, number]);
        latLngs.forEach((ll) => allLatLngs.push(ll));

        // Outer glow line
        const glow = L.polyline(latLngs, {
          color,
          weight: 10,
          opacity: 0.15,
          lineCap: "round",
          lineJoin: "round",
          smoothFactor: 1.5,
        }).addTo(map);

        // Main line
        const line = L.polyline(latLngs, {
          color,
          weight: 4,
          opacity: 0.85,
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

    // Fit bounds
    if (allLatLngs.length > 0) {
      console.log("Drawing", layersRef.current.length, "layers for", filtered.length, "activities");
      map.fitBounds(L.latLngBounds(allLatLngs), { padding: [40, 40], maxZoom: 14 });
    }
  }, [filtered, isConquestMode]);

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

  // ========================================================================
  // RENDER
  // ========================================================================

  const loopCount = filtered.filter((a) => a.route.type === "Polygon").length;
  const lineCount = filtered.filter((a) => a.route.type === "LineString").length;

  return (
    <section className="feature1-map-shell" id="feature1-map">
      <div className="feature1-map-controls">
        <div className="map-top-bar">
          <div className="feature1-map-overlay">
            <div className="pulse-dot" />
            <span>{isConquestMode ? 'Conquered Regions' : 'Activity Map'}</span>
          </div>

          <button 
            className={`map-conquest-toggle ${isConquestMode ? 'active' : ''}`}
            onClick={() => setIsConquestMode(!isConquestMode)}
            title="Toggle Conquest Logic (Overlap Resolution)"
          >
            🔥 {isConquestMode ? 'Exit Conquest' : 'Conquest Mode'}
          </button>

          <div style={{ display: "flex", gap: 8 }}>
            <div className="map-active-badge">
              <span className="map-active-count">{loopCount}</span>
              <span className="map-active-label">Regions</span>
            </div>
            <div className="map-active-badge">
              <span className="map-active-count">{lineCount}</span>
              <span className="map-active-label">Paths</span>
            </div>
          </div>

          <Link className="map-leaderboard-link" href="/feature1/leaderboard">
            🏆 Leaderboard
          </Link>
        </div>

        <div className="map-search-wrap">
          <div className="map-search-box">
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search places in Bengaluru" aria-label="Search" />
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

        <div className="map-filter-wrap">
          <div className="map-filter-group" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
            {(["all", "walk", "cycle"] as const).map((t) => (
              <button key={t} type="button" className={`map-filter-tab ${filter === t ? "map-filter-tab--active" : ""}`} onClick={() => setFilter(t)}>
                {t === "all" ? "All" : t === "walk" ? "🚶 By Walk" : "🚴 By Cycle"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="feature1-map">
        {isLoading && <div className="map-loading"><div className="map-loading-spinner" /><span>Loading map…</span></div>}
        <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />
      </div>

      {/* Legend */}
      {userLegend.length > 0 && (
        <div style={{
          position: "absolute", bottom: 20, left: 20, zIndex: 1200, background: "rgba(10,10,15,0.9)",
          backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16,
          padding: "14px 16px", maxHeight: 250, overflowY: "auto", scrollbarWidth: "none", minWidth: 220,
        }}>
          <div style={{ fontSize: "0.63rem", fontWeight: 800, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
            Users
          </div>
          {userLegend.map((u, i) => (
            <div key={u.username} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{ width: 14, height: 14, borderRadius: 4, background: hexToRgba(u.color, 0.3), border: `2px solid ${u.color}`, flexShrink: 0 }} />
              <span style={{ fontSize: "0.78rem", color: "#fff", fontWeight: 600, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.username}</span>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                {u.loops > 0 && <span style={{ fontSize: "0.62rem", color: u.color, fontWeight: 700, padding: "1px 5px", background: hexToRgba(u.color, 0.1), borderRadius: 4 }}>{fmtArea(u.totalArea)}</span>}
                {u.lines > 0 && <span style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.45)", fontWeight: 600 }}>{u.lines} path{u.lines > 1 ? "s" : ""}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail card */}
      {selectedActivity && (() => {
        const c = selectedActivity.userId?._id 
        ? getUserColor(selectedActivity.userId._id, userColorMapRef.current)
        : "#fff";
        const isLoop = selectedActivity.route.type === "Polygon";
        return (
          <div style={{
            position: "absolute", bottom: 20, right: 20, zIndex: 1200, background: "rgba(10,10,15,0.92)",
            backdropFilter: "blur(16px)", border: `1px solid ${c}44`, borderRadius: 20, padding: "18px 20px", minWidth: 260, maxWidth: 340,
          }}>
            <button onClick={() => setSelectedActivity(null)} style={{ position: "absolute", top: 10, right: 14, background: "transparent", border: "none", color: "rgba(255,255,255,0.5)", fontSize: "1.1rem", cursor: "pointer" }}>×</button>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: "1.6rem" }}>{actIcon(selectedActivity.activityType)}</span>
              <div>
                <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#fff" }}>{selectedActivity.userId?.username || "Unknown"}</div>
                <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.45)" }}>
                  {fmtDate(selectedActivity.startTime)} • {selectedActivity.activityType}
                  <span style={{ marginLeft: 6, padding: "2px 6px", background: isLoop ? hexToRgba(c, 0.15) : "rgba(255,255,255,0.08)", borderRadius: 4, fontSize: "0.62rem", fontWeight: 700, color: isLoop ? c : "rgba(255,255,255,0.5)" }}>
                    {routeLabel(selectedActivity.route.type)}
                  </span>
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
              {isLoop && (
                <div style={{ textAlign: "center", padding: "6px 4px", background: "rgba(255,255,255,0.03)", borderRadius: 10 }}>
                  <div style={{ fontSize: "0.92rem", fontWeight: 700, color: c }}>{fmtArea(selectedActivity.areaSquareMeters)}</div>
                  <div style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>Area Covered</div>
                </div>
              )}
              {[
                { label: "Distance", value: fmtDist(selectedActivity.distanceMeters) },
                { label: "Duration", value: fmtDur(selectedActivity.durationSeconds) },
                { label: "Avg Speed", value: fmtSpeed(selectedActivity.avgSpeed) },
              ].map((s) => (
                <div key={s.label} style={{ textAlign: "center", padding: "6px 4px", background: "rgba(255,255,255,0.03)", borderRadius: 10 }}>
                  <div style={{ fontSize: "0.92rem", fontWeight: 700, color: c }}>{s.value}</div>
                  <div style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: "0.7rem", padding: "4px 8px", background: "rgba(255,255,255,0.05)", borderRadius: 6, color: "rgba(255,255,255,0.45)", textAlign: "center" }}>
              Source: {selectedActivity.source}
            </div>
          </div>
        );
      })()}
    </section>
  );
}
