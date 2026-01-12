
"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Map, MapControl, ControlPosition, useMap } from "@vis.gl/react-google-maps";
import { Loader2, X, Navigation, Car } from "lucide-react";
import FollowingDashboard from "@/components/home/map/following-dashboard";
import { Button } from "@/components/ui/button";
import { MapProvider } from "./map-provider";
import PasswordDialog from "@/components/home/password-dialog";
import { useAuth } from "@/hooks/use-auth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWebSocket } from "@/contexts/websocket-context";
import BackButton from "@/components/home/map/back-button";
import AnimatedMarker from "@/components/home/map/animated-marker";
import PlaybackControls from "@/components/home/map/playback-controls";
import PlaybackDateRangeDialog from "@/components/home/map/playback-daterange-dialog";
import UserLocationMarker from "@/components/home/map/user-location-marker";
import { useLocationIgnitionAlert } from "@/hooks/use-location-ignition-alert";
import { Capacitor } from "@capacitor/core";
import apiClient from "@/lib/api";
import { mapParsedGeofence, ParsedGeofence, Geofence } from "@/lib/geofences";

interface Position {
    latitude: number;
    longitude: number;
    speed: number; 
    course: number;
    attributes: { [key: string]: any };
    serverTime?: string;
    deviceTime?: string;
}

interface Device {
  id: number;
  name: string;
  uniqueId: string;
  status: string;
  lastUpdate: string;
  positionId: number;
  attributes: {
    totalDistance?: number;
    devicePassword?: string;
    [key: string]: any;
  };
  position?: Position;
  expirationTime?: string;
}

const MapUpdater = ({ isFollowing, onBoundsChanged }: { isFollowing: boolean, onBoundsChanged: (details: {center: google.maps.LatLngLiteral, zoom: number}) => void }) => {
    const map = useMap();

    useEffect(() => {
        if (!map) return;
        const listener = map.addListener('bounds_changed', () => {
            if (isFollowing) return;
            const newCenter = map.getCenter();
            const newZoom = map.getZoom();
            if(newCenter && newZoom) {
                onBoundsChanged({center: newCenter.toJSON(), zoom: newZoom})
            }
        });
        return () => listener.remove();
    }, [map, isFollowing, onBoundsChanged]);
    
    return null;
}

const GeofenceLayer = ({ geofences }: { geofences: ParsedGeofence[] }) => {
  const map = useMap();
  const overlaysRef = useRef<Record<number, google.maps.Circle | google.maps.Polygon | google.maps.Polyline>>({});

  useEffect(() => {
    if (!map) return;

    const overlays = overlaysRef.current;
    const activeIds = new Set(geofences.filter(g => g.geometry && (g.center || g.path?.length)).map(g => g.id));

    Object.entries(overlays).forEach(([idStr, overlay]) => {
      const id = Number(idStr);
      if (!activeIds.has(id)) {
        overlay.setMap(null);
        delete overlays[id];
      }
    });

    geofences.forEach(geofence => {
      if (!geofence.geometry) return;

      if (geofence.geometry === "CIRCLE" && geofence.center && typeof geofence.radius === "number") {
        let circle = overlays[geofence.id];
        if (!(circle instanceof google.maps.Circle)) {
          if (circle) circle.setMap(null);
          circle = new google.maps.Circle({ map });
          overlays[geofence.id] = circle;
        }
        (circle as google.maps.Circle).setOptions({
          map,
          center: geofence.center,
          radius: geofence.radius,
          strokeColor: "#dc2626",
          strokeOpacity: 0.85,
          strokeWeight: 2,
          fillColor: "#ef4444",
          fillOpacity: 0.18,
        });
        return;
      }

      if (geofence.geometry === "POLYGON" && geofence.path?.length) {
        let polygon = overlays[geofence.id];
        if (!(polygon instanceof google.maps.Polygon)) {
          if (polygon) polygon.setMap(null);
          polygon = new google.maps.Polygon({ map });
          overlays[geofence.id] = polygon;
        }
        (polygon as google.maps.Polygon).setOptions({
          map,
          paths: geofence.path,
          strokeColor: "#dc2626",
          strokeOpacity: 0.9,
          strokeWeight: 3,
          fillColor: "#ef4444",
          fillOpacity: 0.18,
        });
        return;
      }

      if (geofence.geometry === "LINESTRING" && geofence.path?.length) {
        let polyline = overlays[geofence.id];
        if (!(polyline instanceof google.maps.Polyline)) {
          if (polyline) polyline.setMap(null);
          polyline = new google.maps.Polyline({ map });
          overlays[geofence.id] = polyline;
        }
        (polyline as google.maps.Polyline).setOptions({
          map,
          path: geofence.path,
          strokeColor: "#dc2626",
          strokeOpacity: 0.85,
          strokeWeight: 4,
        });
      }
    });
  }, [map, geofences]);

  useEffect(() => {
    return () => {
      Object.values(overlaysRef.current).forEach(overlay => overlay.setMap(null));
      overlaysRef.current = {};
    };
  }, []);

  return null;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
// Dynamic camera animation timing
const MIN_ANIMATION_DURATION_MS = 800;
const MAX_ANIMATION_DURATION_MS = 12000;

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

function MapPageContent() {
  const { devices: devicesMap, isLoading, isConnected } = useWebSocket();
  const [center, setCenter] = useState({ lat: 24.8607, lng: 67.0011 }); // Default to Karachi
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [zoom, setZoom] = useState(12);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isPlayback, setIsPlayback] = useState(false);
  const [playbackDateRange, setPlaybackDateRange] = useState<{from: Date, to: Date} | null>(null);
  const [showPlaybackDialog, setShowPlaybackDialog] = useState(false);

  const [geofences, setGeofences] = useState<ParsedGeofence[]>([]);


  const [dialogOpen, setDialogOpen] = useState(false);
  const [command, setCommand] = useState<"engineStop" | "engineResume" | null>(null);
  
  const { selectedDeviceForMap, clearSelectedDeviceForMap } = useAuth();
  
  // Get user's current location for mobile marker
  // This hook is called inside WebSocketProvider, so it's safe
  const { currentLocation } = useLocationIgnitionAlert();
  const isMobile = Capacitor.getPlatform() !== 'web';
  
  const devices = useMemo(() => Object.values(devicesMap) as Device[], [devicesMap]);
  const activeDevices = useMemo(() => devices.filter(d => d.position?.latitude && d.position?.longitude), [devices]);
  
  const hasCenteredMap = useRef(false);
  const mapAnimationRef = useRef<number>();
  const cameraDriftRef = useRef<{
    lastTarget: { lat: number; lng: number } | null;
    lastCourse: number;
    lastSpeedKnots: number;
    lastEndTime: number;
    lastUpdateTime: number;
  }>({ lastTarget: null, lastCourse: 0, lastSpeedKnots: 0, lastEndTime: 0, lastUpdateTime: 0 });

  // Track online/offline state for useEffect dependencies
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const handleMarkerClick = useCallback((device: Device, forceFollow = false) => {
    if (selectedDevice?.id === device.id && !forceFollow) {
      setSelectedDevice(null);
      setIsFollowing(false);
      setGeofences([]);
    } else {
      setSelectedDevice(device);
      setIsFollowing(true);
      setIsPlayback(false);
      if (device.position) {
        setCenter({ lat: device.position.latitude, lng: device.position.longitude });
        setZoom(18);
      }
    }
  }, [selectedDevice]);
  const isExpired = (device?: Device | null) => {
    if (!device?.expirationTime) return false;
    const t = Date.parse(device.expirationTime);
    if (Number.isNaN(t)) return false;
    return Date.now() > t;
  };


  // Handle device selection from another page (e.g. dashboard)
  useEffect(() => {
    if (selectedDeviceForMap && devices.length > 0) {
      const fullDeviceDetails = devices.find(d => d.id === selectedDeviceForMap.id);
      if (fullDeviceDetails) {
        // Immediately center on device position (works better in Android WebView)
        if (fullDeviceDetails.position) {
          setCenter({ 
            lat: fullDeviceDetails.position.latitude, 
            lng: fullDeviceDetails.position.longitude 
          });
          setZoom(18);
          // Small delay to ensure map is ready before following (Android WebView fix)
          setTimeout(() => {
            handleMarkerClick(fullDeviceDetails, true);
          }, 100);
        } else {
          handleMarkerClick(fullDeviceDetails, true);
        }
      }
      clearSelectedDeviceForMap();
    }
  }, [selectedDeviceForMap, devices, handleMarkerClick, clearSelectedDeviceForMap]);
  
  // Update center smoothly when following a device
  useEffect(() => {
    // Immediately stop animation if offline
    if (!isOnline) {
        if (mapAnimationRef.current) cancelAnimationFrame(mapAnimationRef.current);
        return;
    }

    if (!isFollowing || !selectedDevice || isPlayback) {
        if (mapAnimationRef.current) cancelAnimationFrame(mapAnimationRef.current);
        return;
    }

    // Stop animation if no internet connection
    if (!navigator.onLine) {
        if (mapAnimationRef.current) cancelAnimationFrame(mapAnimationRef.current);
        return;
    }

    const updatedDevice = devicesMap[selectedDevice.id];
    if (!updatedDevice?.position) return;
    
    const targetPosition = { lat: updatedDevice.position.latitude, lng: updatedDevice.position.longitude };
    
    // Check if this is a new position update (different from last known position)
    const currentTime = performance.now();
    const isNewPosition = !cameraDriftRef.current.lastTarget || 
                         cameraDriftRef.current.lastTarget.lat !== targetPosition.lat ||
                         cameraDriftRef.current.lastTarget.lng !== targetPosition.lng;
    
    // Update lastUpdateTime only when we receive a new position
    if (isNewPosition) {
        cameraDriftRef.current.lastUpdateTime = currentTime;
    }

    // Don't start animation if we haven't received a position update recently
    const timeSinceLastUpdate = currentTime - cameraDriftRef.current.lastUpdateTime;
    const MAX_STALE_DATA_TIME_MS = 30000; // 30 seconds - don't animate with stale data
    
    if (cameraDriftRef.current.lastUpdateTime > 0 && timeSinceLastUpdate > MAX_STALE_DATA_TIME_MS) {
        console.log("Map: Position data is stale, not starting animation");
        return;
    }

    // Compute dynamic duration using distance and last reported speed (knots)
    const distanceMeters = haversineMeters(center.lat, center.lng, targetPosition.lat, targetPosition.lng);
    const speedKnots = updatedDevice.position?.speed ?? 0;
    const speedMps = Math.max(speedKnots * 0.514444, 0);
    let animationDurationMs = MIN_ANIMATION_DURATION_MS;
    
    // More conservative animation duration calculation to prevent revolving
    if (speedMps > 0.1 && isFinite(distanceMeters)) {
      // Use a minimum duration based on distance to prevent very short animations
      const minDurationFromDistance = Math.max(distanceMeters * 2, 1000); // 2ms per meter, min 1s
      const speedBasedDuration = Math.round((distanceMeters / speedMps) * 1000);
      animationDurationMs = Math.max(speedBasedDuration, minDurationFromDistance);
    }
    
    // Clamp to reasonable bounds - prevent very short animations that cause revolving
    animationDurationMs = Math.min(Math.max(animationDurationMs, 2000), MAX_ANIMATION_DURATION_MS);

    const animationStartTime = performance.now();
    const startPosition = { ...center };
    const animationPlannedEnd = animationStartTime + animationDurationMs;
    cameraDriftRef.current = {
      lastTarget: targetPosition,
      lastCourse: updatedDevice.position.course,
      lastSpeedKnots: speedKnots,
      lastEndTime: animationPlannedEnd,
      lastUpdateTime: currentTime,
    };

    const animateMap = () => {
        // Stop animation if internet connection is lost during animation
        if (!navigator.onLine || !isOnline) {
            if (mapAnimationRef.current) cancelAnimationFrame(mapAnimationRef.current);
            mapAnimationRef.current = undefined;
            return;
        }

        const elapsed = performance.now() - animationStartTime;
        const progress = Math.min(animationDurationMs > 0 ? elapsed / animationDurationMs : 1, 1);

        if (progress < 1) {
            const newLat = lerp(startPosition.lat, targetPosition.lat, progress);
            const newLng = lerp(startPosition.lng, targetPosition.lng, progress);
            setCenter({ lat: newLat, lng: newLng });
        } else {
            // Dead-reckon camera past last target at slightly reduced speed to avoid abrupt stop
            // But only if we haven't exceeded the 15-second threshold without updates AND speed > 0
            const currentTime = performance.now();
            const timeSinceLastUpdate = currentTime - cameraDriftRef.current.lastUpdateTime;
            const MAX_DEAD_RECKONING_TIME_MS = 15000; // 15 seconds
            
            // More aggressive check - stop if no updates for 15 seconds OR if offline
            if (timeSinceLastUpdate > MAX_DEAD_RECKONING_TIME_MS || !navigator.onLine || !isOnline) {
                // Stop dead-reckoning after 15 seconds without updates or if offline
                const last = cameraDriftRef.current;
                if (last.lastTarget) {
                    setCenter({ lat: last.lastTarget.lat, lng: last.lastTarget.lng });
                }
                if (mapAnimationRef.current) {
                    cancelAnimationFrame(mapAnimationRef.current);
                    mapAnimationRef.current = undefined;
                }
                return; // Stop animation
            }
            
            // Also stop dead-reckoning if last speed was 0 (stationary)
            const last = cameraDriftRef.current;
            if (last.lastSpeedKnots === 0) {
                if (last.lastTarget) {
                    setCenter({ lat: last.lastTarget.lat, lng: last.lastTarget.lng });
                }
                return; // Stop animation
            }
            
            const extraMs = (currentTime - (cameraDriftRef.current.lastEndTime || currentTime));
            if (last.lastTarget) {
              const lastSpeedMps = Math.max((last.lastSpeedKnots || 0) * 0.514444 * 0.85, 0); // slower drift
              if (lastSpeedMps > 0.1) {
                const driftMeters = lastSpeedMps * Math.max(extraMs, 0) / 1000;
                const toRad = (v: number) => (v * Math.PI) / 180;
                const toDeg = (v: number) => (v * 180) / Math.PI;
                const R = 6371000;
                const δ = driftMeters / R;
                const θ = toRad(last.lastCourse || 0);
                const φ1 = toRad(last.lastTarget.lat);
                const λ1 = toRad(last.lastTarget.lng);
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
                setCenter({ lat: toDeg(φ2), lng: ((toDeg(λ2) + 540) % 360) - 180 });
              } else {
                setCenter({ lat: last.lastTarget.lat, lng: last.lastTarget.lng });
              }
            }
        }

        mapAnimationRef.current = requestAnimationFrame(animateMap);
    };

    if (mapAnimationRef.current) cancelAnimationFrame(mapAnimationRef.current);
    mapAnimationRef.current = requestAnimationFrame(animateMap);
    
    return () => {
        if(mapAnimationRef.current) cancelAnimationFrame(mapAnimationRef.current)
    };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devicesMap, selectedDevice, isFollowing, isPlayback, isOnline]);

  // Handle online/offline events for map animation
  useEffect(() => {
    const handleOnline = () => {
      console.log("Map: Browser is online, animation can resume");
      setIsOnline(true);
    };
    
    const handleOffline = () => {
      console.log("Map: Browser is offline, stopping all animations");
      setIsOnline(false);
      if (mapAnimationRef.current) {
        cancelAnimationFrame(mapAnimationRef.current);
        mapAnimationRef.current = undefined;
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Status warning component
  const StatusWarning = () => {
    if (!isOnline) {
      return (
        <div className="bg-red-500 text-white px-3 py-2 rounded-md shadow-lg text-center">
          <p className="font-semibold text-xs sm:text-sm">No Internet Connection</p>
        </div>
      );
    }
    
    if (!isConnected) {
      return (
        <div className="bg-red-500 text-white px-3 py-2 rounded-md shadow-lg text-center">
          <p className="font-semibold text-xs sm:text-sm">Server Connection Lost</p>
        </div>
      );
    }
    
    return null;
  };

  // Set initial map center only once
  useEffect(() => {
    if (!selectedDevice && activeDevices.length > 0 && !hasCenteredMap.current) {
      const onlineDevice = activeDevices.find(d => d.status === 'online');
      const targetDevice = onlineDevice || activeDevices[0];
      if (targetDevice.position) {
        setCenter({ lat: targetDevice.position.latitude, lng: targetDevice.position.longitude });
        setZoom(12);
        hasCenteredMap.current = true;
      }
    }
  }, [selectedDevice, activeDevices]);

  const handleStopFollowing = () => {
    setSelectedDevice(null);
    setIsFollowing(false);
    setIsPlayback(false);
    setPlaybackDateRange(null);
    setZoom(12);
    setGeofences([]);
  };
  
  const handleEngineCommand = (cmd: "engineStop" | "engineResume") => {
    if (!selectedDevice) return;
    if (isExpired(selectedDevice)) {
      const msg = encodeURIComponent('how can i pay?');
      const url = `https://wa.me/923234402200?text=${msg}`;
      window.open(url, '_blank');
      return;
    }
    setCommand(cmd);
    setDialogOpen(true);
  }

  const handleDeviceSelect = (deviceId: string) => {
    const deviceToSelect = devices.find(d => d.id.toString() === deviceId);
    if (deviceToSelect) {
        handleMarkerClick(deviceToSelect, true);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    if (!selectedDevice) {
      setGeofences([]);
      return () => {
        cancelled = true;
        controller.abort();
      };
    }

    const fetchGeofences = async () => {
      try {
        const response = await apiClient.get<Geofence[]>(`/geofences?deviceId=${selectedDevice.id}`, {
          signal: controller.signal,
        });
        if (cancelled) return;
        const parsed = (response.data || []).map(mapParsedGeofence);
        setGeofences(parsed);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Failed to fetch geofences for device", selectedDevice.id, error);
        if (!cancelled) {
          setGeofences([]);
        }
      }
    };

    fetchGeofences();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [selectedDevice?.id]);

  const handleBoundsChanged = useCallback(({center, zoom}: {center: google.maps.LatLngLiteral, zoom: number}) => {
    setCenter(center);
    setZoom(zoom);
  }, [])
  
  const handleStartPlayback = (range: {from: Date, to: Date}) => {
    setPlaybackDateRange(range);
    setIsPlayback(true);
    setIsFollowing(false); // Stop live following during playback
    setShowPlaybackDialog(false);
  }
  
  const handleStopPlayback = () => {
    setIsPlayback(false);
    setPlaybackDateRange(null);
    if (selectedDevice) {
        setIsFollowing(true); // Resume following after playback
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-card rounded-lg">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground roman-urdu">
          Tracker ki location hasil ki ja rahi hai
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden map-container">
        {activeDevices.length > 0 ? (
          <Map
            key={selectedDevice ? `following-${selectedDevice.id}` : "overview-map"}
            style={{ width: "100%", height: "100%" }}
            center={center}
            zoom={zoom}
            gestureHandling={'greedy'}
            disableDefaultUI={false}
            mapId={"al-muhafiz-map"}
            onDragstart={() => isFollowing && setIsFollowing(false)}
          >
            <MapUpdater isFollowing={isFollowing && !isPlayback} onBoundsChanged={handleBoundsChanged} />
            {geofences.length > 0 && (
              <GeofenceLayer geofences={geofences} />
            )}
            
            {/* Status Warning - Absolute positioned for mobile compatibility */}
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
              <StatusWarning />
            </div>
            
            {/* Center on Vehicle Button - Only show when device is selected */}
            {selectedDevice && (
              <div className="absolute bottom-4 left-4 z-10">
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-background/90 dark:bg-card/90 hover:bg-background dark:hover:bg-card shadow-lg text-foreground"
                  onClick={() => {
                    if (selectedDevice.position) {
                      setCenter({ 
                        lat: selectedDevice.position.latitude, 
                        lng: selectedDevice.position.longitude 
                      });
                      setZoom(18);
                    }
                  }}
                >
                  <Car className="h-4 w-4 mr-2" />
                  Center on Vehicle
                </Button>
              </div>
            )}
            
            {/* Custom Zoom Controls */}
            <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
              <Button
                size="sm"
                variant="outline"
                className="bg-background/90 dark:bg-card/90 hover:bg-background dark:hover:bg-card shadow-lg text-foreground"
                onClick={() => setZoom(prev => Math.min(prev + 1, 20))}
              >
                <span className="text-lg font-bold">+</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="bg-background/90 dark:bg-card/90 hover:bg-background dark:hover:bg-card shadow-lg text-foreground"
                onClick={() => setZoom(prev => Math.max(prev - 1, 1))}
              >
                <span className="text-lg font-bold">−</span>
              </Button>
            </div>
            
            {!isPlayback && activeDevices.map((device) => (
              device.position && (
                <AnimatedMarker
                    key={device.id}
                    device={device}
                    isSelected={device.id === selectedDevice?.id}
                    onClick={() => handleMarkerClick(device)}
                />
              )
            ))}

            {/* Show user's mobile location marker */}
            {isMobile && !isPlayback && currentLocation && currentLocation.latitude && currentLocation.longitude && (
              <UserLocationMarker
                latitude={currentLocation.latitude}
                longitude={currentLocation.longitude}
                heading={currentLocation.heading}
              />
            )}

              <MapControl position={ControlPosition.TOP_RIGHT}>
                <div className="map-control-top-right p-2 sm:p-4 flex flex-col gap-2 items-end z-20">
                  <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                    <Select onValueChange={handleDeviceSelect} value={selectedDevice?.id.toString() ?? ''}>
                        <SelectTrigger className="w-[140px] sm:w-[180px] md:w-[200px] bg-background dark:bg-card shadow-lg text-xs sm:text-sm border-2 border-border dark:border-border text-foreground">
                            <SelectValue placeholder="Select device" />
                        </SelectTrigger>
                        <SelectContent className="z-30 bg-background dark:bg-card">
                            {devices.map(device => (
                                <SelectItem key={device.id} value={device.id.toString()} className="text-foreground">
                                    <div className="flex items-center gap-2">
                                        <Car className="h-3 w-3 sm:h-4 sm:w-4" />
                                        <span className="text-xs sm:text-sm truncate max-w-[100px] sm:max-w-[130px] md:max-w-[150px] text-foreground">
                                          {device.name}
                                        </span>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {(isFollowing || isPlayback) && selectedDevice && (
                        <Button 
                            onClick={handleStopFollowing}
                            variant="destructive"
                            className="shadow-lg text-xs sm:text-sm px-2 sm:px-4 border-2 border-red-500/20"
                            size="sm"
                        >
                            <X className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" /> 
                            <span className="hidden sm:inline">Stop</span>
                        </Button>
                    )}
                  </div>
                  <BackButton />
                </div>
              </MapControl>
              {isPlayback && selectedDevice && playbackDateRange && (
                 <PlaybackControls 
                    device={selectedDevice} 
                    dateRange={playbackDateRange}
                    onStop={handleStopPlayback} 
                 />
              )}
          </Map>
        ) : (
          <div className="flex items-center justify-center h-full bg-muted">
            <div className="text-center text-muted-foreground roman-urdu">
              <Navigation className="h-12 w-12 mx-auto mb-4" />
              <p className="text-lg font-semibold">Location ki maloomat nahi mil saki.</p>
              <p>Koi device online nahi ya data fetch nahi ho saka.</p>
            </div>
          </div>
        )}
      {selectedDevice && !isPlayback && (
        <FollowingDashboard 
          device={selectedDevice} 
          onEngineCommand={handleEngineCommand} 
          onPlayback={() => setShowPlaybackDialog(true)}
        />
      )}
      
      {selectedDevice && (
        <PlaybackDateRangeDialog
            open={showPlaybackDialog}
            onOpenChange={setShowPlaybackDialog}
            onSelectRange={handleStartPlayback}
        />
      )}


      {command && selectedDevice && (
        <PasswordDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          commandType={command}
          device={selectedDevice}
        />
      )}
    </div>
  );
}

export default function MapPage() {
  return (
    <div className="h-full w-full absolute inset-0">
      <MapProvider>
        <MapPageContent />
      </MapProvider>
    </div>
  )
}
