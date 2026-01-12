
"use client";

import { useState, useEffect, useRef } from "react";
import { AdvancedMarker, useMap } from "@vis.gl/react-google-maps";

interface Device {
    id: number;
    name: string;
    status: string;
    position?: {
        latitude: number;
        longitude: number;
        speed?: number; // knots (Traccar default)
        course: number;
        serverTime?: string;
    };
}

interface AnimatedMarkerProps {
    device: Device;
    isSelected: boolean;
    onClick: () => void;
    disableSmoothing?: boolean;
}

// Default min/max animation durations to keep movement natural
const MIN_ANIMATION_DURATION_MS = 800;
const MAX_ANIMATION_DURATION_MS = 12000; // trackers often report ~12s
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Haversine distance in meters
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = (v: number) => (v * Math.PI) / 180;
    const R = 6371000; // meters
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Destination point given start, bearing (deg), and distance (m)
function destinationPoint(lat: number, lon: number, bearingDeg: number, distanceM: number) {
    const R = 6371000; // meters
    const δ = distanceM / R; // angular distance in radians
    const θ = (bearingDeg * Math.PI) / 180;
    const φ1 = (lat * Math.PI) / 180;
    const λ1 = (lon * Math.PI) / 180;

    const sinφ1 = Math.sin(φ1);
    const cosφ1 = Math.cos(φ1);
    const sinδ = Math.sin(δ);
    const cosδ = Math.cos(δ);
    const sinθ = Math.sin(θ);
    const cosθ = Math.cos(θ);

    const sinφ2 = sinφ1 * cosδ + cosφ1 * sinδ * cosθ;
    const φ2 = Math.asin(sinφ2);
    const y = sinθ * sinδ * cosφ1;
    const x = cosδ - sinφ1 * sinφ2;
    const λ2 = λ1 + Math.atan2(y, x);

    return {
        lat: (φ2 * 180) / Math.PI,
        lng: ((λ2 * 180) / Math.PI + 540) % 360 - 180, // normalize to -180..+180
    };
}

const AnimatedMarker = ({ device, isSelected, onClick, disableSmoothing = false }: AnimatedMarkerProps) => {
    const map = useMap();
    const [currentPos, setCurrentPos] = useState({ lat: device.position!.latitude, lng: device.position!.longitude });
    const [currentRot, setCurrentRot] = useState(device.position!.course);
    const [isBackfill, setIsBackfill] = useState<boolean>(true);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const trailRef = useRef<google.maps.Polyline | null>(null);
    const trailTimerRef = useRef<number | null>(null);
    
    const animationState = useRef({
      startTime: performance.now(),
      durationMs: MIN_ANIMATION_DURATION_MS,
      startPos: { lat: device.position!.latitude, lng: device.position!.longitude },
      targetPos: { lat: device.position!.latitude, lng: device.position!.longitude },
      startRot: device.position!.course,
      targetRot: device.position!.course,
      animationFrameId: 0,
      lastUpdateTime: performance.now()
    });

    // Persist last non-zero movement to continue drifting even if next reports have speed 0
    const lastSpeedKnotsRef = useRef<number>(device.position?.speed ?? 0);
    const lastCourseRef = useRef<number>(device.position?.course ?? 0);
    const lastReportTsRef = useRef<number>(
        device.position?.serverTime ? new Date(device.position.serverTime).getTime() : Date.now()
    );

    // Handle online/offline events
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => {
            setIsOnline(false);
            // Stop animation when offline
            if (animationState.current.animationFrameId) {
                cancelAnimationFrame(animationState.current.animationFrameId);
                animationState.current.animationFrameId = 0;
            }
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    useEffect(() => {
        if (disableSmoothing) {
            if (animationState.current.animationFrameId) {
                cancelAnimationFrame(animationState.current.animationFrameId);
                animationState.current.animationFrameId = 0;
            }
            if (device.position) {
                const snapshot = {
                    lat: device.position.latitude,
                    lng: device.position.longitude,
                };
                setCurrentPos(snapshot);
                setCurrentRot(device.position.course);
            }
            return;
        }

        // When a new device position comes in, update the target
        const now = performance.now();
        const nextPos = { lat: device.position!.latitude, lng: device.position!.longitude };
        const reportTs = device.position?.serverTime ? new Date(device.position.serverTime).getTime() : Date.now();

        // If this is a fresh report from WebSocket, snap instantly to the reported position
        if (reportTs !== lastReportTsRef.current) {
            lastReportTsRef.current = reportTs;
            animationState.current.lastUpdateTime = now; // Update last update time
            setCurrentPos(nextPos);
            setCurrentRot(device.position!.course);
            // Reset animation baseline to this point to avoid back/forward snap
            animationState.current.startTime = now;
            animationState.current.durationMs = MIN_ANIMATION_DURATION_MS;
            animationState.current.startPos = { ...nextPos };
            animationState.current.targetPos = { ...nextPos };
            animationState.current.startRot = device.position!.course;
            animationState.current.targetRot = device.position!.course;
            // Also seed drift with the latest movement
            if ((device.position?.speed ?? 0) > 0.1) {
                lastSpeedKnotsRef.current = device.position!.speed!;
                lastCourseRef.current = device.position!.course;
            }
        }

        // Update last non-zero speed and course
        const incomingSpeedKnots = device.position?.speed ?? 0;
        const incomingCourse = device.position?.course ?? lastCourseRef.current;
        if (incomingSpeedKnots > 0.1) {
            lastSpeedKnotsRef.current = incomingSpeedKnots;
            lastCourseRef.current = incomingCourse;
        }

        // Try to render 12s behind using local history if available
        try {
            const key = `deviceHistory:${device.id}`;
            const raw = localStorage.getItem(key);
            if (raw) {
                const arr: Array<{ lat: number; lng: number; course: number; speed?: number; ts: number }> = JSON.parse(raw);
                const targetTs = Date.now() - 12000; // 12s behind
                // Find two points bracketing targetTs
                let before = null as any;
                let after = null as any;
                for (let i = arr.length - 1; i >= 0; i--) {
                    if (arr[i].ts <= targetTs) { before = arr[i]; after = arr[i + 1] || arr[i]; break; }
                }
                if (!before && arr.length) { before = arr[0]; after = arr[1] || arr[0]; }
                if (before && after) {
                    const span = Math.max(after.ts - before.ts, 1);
                    const t = Math.min(Math.max((targetTs - before.ts) / span, 0), 1);
                    const lat = lerp(before.lat, after.lat, t);
                    const lng = lerp(before.lng, after.lng, t);
                    const course = after.course;
                    const speedKnotsFromHist = (after.speed ?? lastSpeedKnotsRef.current);
                    // Seed state from history point
                    setCurrentPos({ lat, lng });
                    setCurrentRot(course);
                    lastCourseRef.current = course;
                    if (speedKnotsFromHist > 0.1) lastSpeedKnotsRef.current = speedKnotsFromHist;
                    setIsBackfill(true);
                } else {
                    setIsBackfill(false);
                }
            } else {
                setIsBackfill(false);
            }
        } catch {
            setIsBackfill(false);
        }

        // Compute dynamic duration using last reported speed and distance to target
        const distanceMeters = haversineMeters(currentPos.lat, currentPos.lng, nextPos.lat, nextPos.lng);
        const speedKnots = lastSpeedKnotsRef.current; // use persisted non-zero speed
        const speedMps = Math.max(speedKnots * 0.514444, 0); // convert knots -> m/s

        // If speed is 0 or very small, fall back to a short animation; otherwise time = distance / speed
        let durationMs = MIN_ANIMATION_DURATION_MS;
        if (speedMps > 0.1 && isFinite(distanceMeters)) {
            durationMs = Math.round((distanceMeters / speedMps) * 1000);
        }
        // Clamp to sane bounds so it neither snaps nor crawls
        durationMs = Math.min(Math.max(durationMs, MIN_ANIMATION_DURATION_MS), MAX_ANIMATION_DURATION_MS);

        animationState.current.startTime = now;
        animationState.current.durationMs = durationMs;
        animationState.current.startPos = { ...currentPos };
        animationState.current.targetPos = nextPos;
        animationState.current.startRot = currentRot;
        animationState.current.targetRot = incomingCourse;

        const animate = () => {
            // Stop animation if offline
            if (!navigator.onLine || !isOnline) {
                if (animationState.current.animationFrameId) {
                    cancelAnimationFrame(animationState.current.animationFrameId);
                    animationState.current.animationFrameId = 0;
                }
                return;
            }

            const { startTime, durationMs, startPos, targetPos, startRot, targetRot, lastUpdateTime } = animationState.current;
            const now = performance.now();
            const elapsed = now - startTime;
            const progress = Math.min(durationMs > 0 ? elapsed / durationMs : 1, 1);

            if (progress < 1) {
                // Interpolate towards last reported point
                const lat = lerp(startPos.lat, targetPos.lat, progress);
                const lng = lerp(startPos.lng, targetPos.lng, progress);
                setCurrentPos({ lat, lng });

                // Interpolate rotation (shortest path)
                let rotDiff = targetRot - startRot;
                if (rotDiff > 180) rotDiff -= 360;
                if (rotDiff < -180) rotDiff += 360;
                const rot = (startRot + rotDiff * progress + 360) % 360; // Keep within 0-360
                setCurrentRot(rot);
            } else {
                // Dead-reckoning: continue moving beyond last report slightly slower
                // But only if we haven't exceeded the 15-second threshold without updates
                const timeSinceLastUpdate = now - lastUpdateTime;
                const MAX_DEAD_RECKONING_TIME_MS = 15000; // 15 seconds
                
                if (timeSinceLastUpdate > MAX_DEAD_RECKONING_TIME_MS) {
                    // Stop dead-reckoning after 15 seconds without updates
                    if (animationState.current.animationFrameId) {
                        cancelAnimationFrame(animationState.current.animationFrameId);
                        animationState.current.animationFrameId = 0;
                    }
                    return;
                }
                
                // Also stop if last speed was 0 (stationary)
                if (lastSpeedKnotsRef.current === 0) {
                    if (animationState.current.animationFrameId) {
                        cancelAnimationFrame(animationState.current.animationFrameId);
                        animationState.current.animationFrameId = 0;
                    }
                    return;
                }

                const extraMs = elapsed - durationMs;
                const speedKnots = lastSpeedKnotsRef.current;
                const speedMps = Math.max(speedKnots * 0.514444, 0);
                const reducedSpeedMps = speedMps * 0.85; // slightly slower than reported speed
                if (reducedSpeedMps > 0.1) {
                    const distance = reducedSpeedMps * (extraMs / 1000);
                    const projected = destinationPoint(
                        targetPos.lat,
                        targetPos.lng,
                        lastCourseRef.current,
                        distance
                    );
                    setCurrentPos(projected);
                    // keep currentRot aligned to course
                    setCurrentRot(lastCourseRef.current);
                } else {
                    // if almost stationary, hold position
                    setCurrentPos({ lat: targetPos.lat, lng: targetPos.lng });
                    setCurrentRot(lastCourseRef.current);
                }
            }

            animationState.current.animationFrameId = requestAnimationFrame(animate);
        };

        // Start animation loop
        if (animationState.current.animationFrameId) {
            cancelAnimationFrame(animationState.current.animationFrameId);
        }
        animationState.current.animationFrameId = requestAnimationFrame(animate);

        return () => {
            if (animationState.current.animationFrameId) {
                cancelAnimationFrame(animationState.current.animationFrameId);
            }
        };
    }, [device.position, disableSmoothing, isOnline]); // Include isOnline in dependencies

    // Draw and update a faint trail polyline using local history up to 12s behind now
    useEffect(() => {
        if (disableSmoothing) {
            return;
        }
        if (!map) return;

        // Create polyline if not exists
        if (!trailRef.current) {
            trailRef.current = new google.maps.Polyline({
                path: [],
                strokeColor: "#2962FF",
                strokeOpacity: 0.5,
                strokeWeight: 3,
                map: map,
            });
        } else {
            trailRef.current.setMap(map);
        }

        const updateTrail = () => {
            try {
                const raw = localStorage.getItem(`deviceHistory:${device.id}`);
                if (!raw) return;
                const arr: Array<{ lat: number; lng: number; ts: number }> = JSON.parse(raw);
                const targetTs = Date.now() - 12000;
                const pts = arr.filter(p => p.ts <= targetTs);
                const lastPts = pts.length > 300 ? pts.slice(pts.length - 300) : pts; // keep last ~300 points
                const path = lastPts.map(p => ({ lat: p.lat, lng: p.lng }));
                trailRef.current?.setPath(path as any);
            } catch (_) {
                // ignore parse errors
            }
        };

        // initial draw and periodic updates
        updateTrail();
        trailTimerRef.current = window.setInterval(updateTrail, 2000) as unknown as number;

        return () => {
            if (trailTimerRef.current) {
                clearInterval(trailTimerRef.current);
                trailTimerRef.current = null;
            }
            if (trailRef.current) {
                trailRef.current.setMap(null);
                trailRef.current = null;
            }
        };
    }, [map, device.id, disableSmoothing]);


    if (!device.position) return null;

    return (
        <AdvancedMarker
            position={disableSmoothing && device.position ? { lat: device.position.latitude, lng: device.position.longitude } : currentPos}
            title={device.name}
            onClick={onClick}
        >
            <div style={{ transform: `rotate(${currentRot}deg)` }} className="relative flex flex-col items-center transition-transform duration-500">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L2.5 21.5L12 17L21.5 21.5L12 2Z"
                        fill={isSelected ? '#ff5722' : (device.status === 'online' ? '#2962FF' : '#9E9E9E')}
                        stroke="white"
                        strokeWidth="1.5"
                        strokeLinejoin="round" />
                </svg>
                <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-white/80 text-black text-xs font-bold px-2 py-1 rounded-md whitespace-nowrap">
                    {device.name}
                </span>
            </div>
        </AdvancedMarker>
    );
};

export default AnimatedMarker;
