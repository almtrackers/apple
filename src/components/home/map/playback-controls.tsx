
"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useMap } from "@vis.gl/react-google-maps";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, FastForward, X, AlertTriangle, Route } from "lucide-react";
import AnimatedMarker from "./animated-marker";
import apiClient from "@/lib/api";
import { format } from "date-fns";
import { formatDistance } from "@/lib/utils";

interface Position {
    latitude: number;
    longitude: number;
    speed: number;
    course: number;
    attributes: any;
    deviceTime: string;
}

interface Device {
  id: number;
  name: string;
  uniqueId: string;
  position?: {
    latitude: number;
    longitude: number;
    course: number;
  };
}

interface PlaybackControlsProps {
    device: Device;
    dateRange: { from: Date, to: Date };
    onStop: () => void;
}

const playbackSpeeds = [1, 2, 5, 10, 20];

// Haversine formula to calculate distance between two lat/lng points in meters
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
}


export default function PlaybackControls({ device, dateRange, onStop }: PlaybackControlsProps) {
    const map = useMap();
    const [route, setRoute] = useState<Position[]>([]);
    const [totalDistance, setTotalDistance] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentSpeedIndex, setCurrentSpeedIndex] = useState(2); // Default to 5x
    
    const animationFrameRef = useRef<number>();
    const polylineRef = useRef<google.maps.Polyline | null>(null);
    const playbackStateRef = useRef({
        routeIndex: 0,
        lastFrameTime: performance.now(),
    });

    const currentPosition = useMemo(() => {
        if (!route.length) return null;
        const index = Math.floor(progress * (route.length - 1));
        return route[index];
    }, [route, progress]);
    
    // Fetch route data
    useEffect(() => {
        const fetchRoute = async () => {
            setIsLoading(true);
            setError(null);
            setTotalDistance(0);
            
            try {
                const response = await apiClient.get<Position[]>(`/reports/route?deviceId=${device.id}&from=${dateRange.from.toISOString()}&to=${dateRange.to.toISOString()}`);
                if (response.data && response.data.length > 0) {
                    setRoute(response.data);
                    // Calculate total distance
                    let distance = 0;
                    for (let i = 1; i < response.data.length; i++) {
                        const pos1 = response.data[i-1];
                        const pos2 = response.data[i];
                        distance += getDistance(pos1.latitude, pos1.longitude, pos2.latitude, pos2.longitude);
                    }
                    setTotalDistance(distance);

                } else {
                    setError(`No route data found for ${format(dateRange.from, 'PPP')} to ${format(dateRange.to, 'PPP')}.`);
                }
            } catch (err) {
                setError("Failed to fetch route data.");
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchRoute();
    }, [device.id, dateRange]);

    // Create and manage the polyline
    useEffect(() => {
      if (!map || !route.length) return;

      if (polylineRef.current) {
        polylineRef.current.setMap(null);
      }

      polylineRef.current = new window.google.maps.Polyline({
          path: route.map(p => ({ lat: p.latitude, lng: p.longitude })),
          strokeColor: "#0000FF",
          strokeOpacity: 0.8,
          strokeWeight: 4,
          map: map,
      });

      return () => {
        if (polylineRef.current) {
          polylineRef.current.setMap(null);
        }
      };
    }, [map, route]);


    const animate = useCallback(() => {
        const now = performance.now();
        const deltaTime = now - playbackStateRef.current.lastFrameTime;
        
        if (isPlaying) {
            setProgress(prev => {
                const newProgress = prev + (0.0001 * playbackSpeeds[currentSpeedIndex] * (deltaTime / 16));
                if (newProgress >= 1) {
                    setIsPlaying(false);
                    return 1;
                }
                return newProgress;
            });
        }
        
        playbackStateRef.current.lastFrameTime = now;
        animationFrameRef.current = requestAnimationFrame(animate);
    }, [isPlaying, currentSpeedIndex]);

    useEffect(() => {
        playbackStateRef.current.lastFrameTime = performance.now();
        animationFrameRef.current = requestAnimationFrame(animate);
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [animate]);

    // Center map on route
    useEffect(() => {
        if (route.length > 0 && map) {
            const bounds = new google.maps.LatLngBounds();
            route.forEach(pos => bounds.extend({ lat: pos.latitude, lng: pos.longitude }));
            map.fitBounds(bounds, 100);
        }
    }, [route, map]);
    
    useEffect(() => {
        if (currentPosition && map && isPlaying) {
            map.panTo({ lat: currentPosition.latitude, lng: currentPosition.longitude });
        }
    }, [currentPosition, map, isPlaying]);


    const handleSliderChange = (value: number[]) => {
        setProgress(value[0] / 100);
        setIsPlaying(false);
    };
    
    const handleSpeedChange = () => {
        setCurrentSpeedIndex(prev => (prev + 1) % playbackSpeeds.length);
    }
    
    if (isLoading) return <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white bg-black/50 p-2 rounded">Loading Playback...</div>;
    if (error) return (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white bg-destructive/80 p-3 rounded-lg shadow-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5"/>
            <span>{error}</span>
            <Button onClick={onStop} variant="ghost" size="icon" className="h-6 w-6 text-white hover:bg-white/20">
                <X className="h-4 w-4" />
            </Button>
        </div>
    );


    const playbackDevice = {
        ...device,
        status: 'online', // for marker color
        position: currentPosition ? {
            latitude: currentPosition.latitude,
            longitude: currentPosition.longitude,
            course: currentPosition.course,
            speed: currentPosition.speed,
        } : device.position
    }

    return (
        <>
            {currentPosition && (
                <AnimatedMarker
                    device={playbackDevice as Device & { status: string }}
                    isSelected={true}
                    onClick={() => {}}
                    disableSmoothing
                />
            )}
            
            <div className="absolute bottom-0 left-0 right-0 z-10 p-4">
                <Card className="max-w-lg mx-auto bg-card/80 backdrop-blur-sm">
                    <CardContent className="p-4 space-y-3">
                        <div className="flex justify-between items-center text-sm">
                            <span className="font-semibold">{device.name} - Playback</span>
                             <Button onClick={onStop} variant="ghost" size="icon" className="h-6 w-6">
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        
                        <div className="flex items-center gap-4">
                           <Button onClick={() => setIsPlaying(p => !p)} size="icon">
                                {isPlaying ? <Pause /> : <Play />}
                           </Button>
                           <div className="flex-grow space-y-1">
                             <Slider 
                                defaultValue={[0]} 
                                value={[progress * 100]}
                                max={100} 
                                step={0.1}
                                onValueChange={handleSliderChange}
                             />
                             <div className="flex justify-between text-xs text-muted-foreground">
                                <span>{currentPosition ? format(new Date(currentPosition.deviceTime), 'p') : '--:--'}</span>
                                <span>{route.length > 0 ? format(new Date(route[route.length-1].deviceTime), 'p') : '--:--'}</span>
                             </div>
                           </div>
                           <Button onClick={handleSpeedChange} variant="outline" className="w-20">
                                <FastForward className="mr-2 h-4 w-4" /> {playbackSpeeds[currentSpeedIndex]}x
                           </Button>
                        </div>

                         <div className="grid grid-cols-3 gap-2 text-center text-sm pt-2">
                            <div className="bg-muted p-2 rounded-lg">
                                <p className="font-bold">{((currentPosition?.speed || 0) * 1.852).toFixed(0)} km/h</p>
                                <p className="text-xs text-muted-foreground">Speed</p>
                            </div>
                             <div className="bg-muted p-2 rounded-lg">
                                <p className="font-bold">{formatDistance(totalDistance)}</p>
                                <p className="text-xs text-muted-foreground">Distance</p>
                            </div>
                             <div className="bg-muted p-2 rounded-lg">
                                <p className="font-bold">{format(dateRange.from, 'd MMM')} - {format(dateRange.to, 'd MMM')}</p>
                                <p className="text-xs text-muted-foreground">Period</p>
                            </div>
                         </div>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

    