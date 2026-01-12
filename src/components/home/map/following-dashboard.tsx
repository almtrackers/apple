
"use client";

import { useState, useEffect } from "react";
import Speedometer from "./speedometer";
import StatCard from "./stat-card";
import { formatDistance } from "@/lib/utils";
import apiClient from "@/lib/api";
import { Route, Gauge, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWebSocket } from "@/contexts/websocket-context";

interface Device {
  id: number;
  uniqueId: string;
  attributes: {
    totalDistance?: number;
    [key: string]: any;
  };
  position?: {
    speed: number; // knots
    attributes: {
      totalDistance?: number;
      [key: string]: any;
    };
  };
}

interface Trip {
    distance: number;
}

interface FollowingDashboardProps {
  device: Device;
  onEngineCommand: (command: "engineStop" | "engineResume") => void;
  onPlayback: () => void;
}

export default function FollowingDashboard({ device: initialDevice, onEngineCommand, onPlayback }: FollowingDashboardProps) {
  const [todaysDistance, setTodaysDistance] = useState(0);
  const { devices } = useWebSocket();
  
  // Use the live device data from the context, falling back to the initial prop
  const device = devices[initialDevice.id] || initialDevice;

  useEffect(() => {
    const fetchTodaysTrips = async () => {
      if (!device) return;

      const from = new Date();
      from.setHours(0, 0, 0, 0);
      const to = new Date();

      try {
        const res = await apiClient.get(
          `/reports/trips?deviceId=${device.id}&from=${from.toISOString()}&to=${to.toISOString()}`
        );
        if (res.data && Array.isArray(res.data)) {
          const totalDistance = res.data.reduce(
            (acc, trip: Trip) => acc + (Number(trip.distance) || 0),
            0
          );
          setTodaysDistance(totalDistance);
        }
      } catch (error) {
        console.error("Failed to fetch today's trips", error);
      }
    };

    fetchTodaysTrips();
    const interval = setInterval(fetchTodaysTrips, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [device]);
  
  const speedKmh = (device.position?.speed || 0) * 1.852;
  const odometer = device.position?.attributes?.totalDistance || device.attributes.totalDistance || 0;

  return (
    <div className="following-dashboard absolute bottom-0 left-0 right-0 z-10 p-1 sm:p-2 md:p-4 pb-safe mb-2 sm:mb-4">
        <div className="max-w-4xl mx-auto space-y-1 sm:space-y-2 md:space-y-4">
             <div className="grid grid-cols-3 items-end gap-1 sm:gap-2 md:gap-4">
                <StatCard
                    icon={Route}
                    label={
                        <>
                            <span className="sm:hidden">Today</span>
                            <span className="hidden sm:inline">Today's Distance</span>
                        </>
                    }
                    value={formatDistance(todaysDistance)}
                />
                <Speedometer speed={speedKmh} />
                <StatCard
                    icon={Gauge}
                    label="Odometer"
                    value={formatDistance(odometer)}
                />
            </div>
            <div className="grid grid-cols-3 gap-1 sm:gap-2 md:gap-4 max-w-sm sm:max-w-md md:max-w-lg mx-auto">
                <Button 
                    variant="destructive" 
                    size="sm" 
                    className="h-10 sm:h-12 md:h-auto shadow-lg text-xs sm:text-sm px-1 sm:px-2 md:px-4" 
                    onClick={() => onEngineCommand('engineStop')}
                >
                    <span className="hidden sm:inline">Engine Off</span>
                    <span className="sm:hidden">Off</span>
                </Button>
                <Button 
                    className="bg-blue-600 hover:bg-blue-700 shadow-lg text-xs sm:text-sm px-1 sm:px-2 md:px-4" 
                    size="sm" 
                    onClick={onPlayback}
                >
                    <Play className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4"/>
                    <span className="hidden sm:inline">Playback</span>
                    <span className="sm:hidden">Play</span>
                </Button>
                <Button 
                    className="bg-green-600 hover:bg-green-700 shadow-lg text-xs sm:text-sm px-1 sm:px-2 md:px-4" 
                    size="sm" 
                    onClick={() => onEngineCommand('engineResume')}
                >
                    <span className="hidden sm:inline">Engine On</span>
                    <span className="sm:hidden">On</span>
                </Button>
            </div>
        </div>
    </div>
  );
}
