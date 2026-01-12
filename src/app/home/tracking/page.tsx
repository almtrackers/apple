
"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, RadioTower, CheckCircle, XCircle, Power, PowerOff, Clock, Car } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import apiClient from "@/lib/api";

interface Device {
  id: number;
  name: string;
  uniqueId: string;
}

export default function TrackingPage() {
  const { toast } = useToast();
  const [isTracking, setIsTracking] = useState(false);
  const [status, setStatus] = useState<"idle" | "tracking" | "error">("idle");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [loadingDevices, setLoadingDevices] = useState(true);

  const watchIdRef = useRef<number | null>(null);
  const OSMAND_PORT = 5055; // Default OsmAnd port

  useEffect(() => {
    const fetchDevices = async () => {
      setLoadingDevices(true);
      try {
        const response = await apiClient.get<Device[]>('/devices');
        setDevices(response.data);
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Devices load nahi ho sake.",
        });
      } finally {
        setLoadingDevices(false);
      }
    };
    fetchDevices();
  }, [toast]);

  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
    setStatus("idle");
    console.log("Tracking stopped.");
  };

  const startTracking = () => {
    if (!selectedDevice) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Pehle device select karain.",
      });
      return;
    }

    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      setStatus("error");
      return;
    }

    setIsTracking(true);
    setError(null);
    setStatus("tracking");

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude, speed, accuracy, altitude, heading } = position.coords;
        setLastUpdate(new Date(position.timestamp));

        const baseUrl = new URL(process.env.NEXT_PUBLIC_TRACCAR_URL || 'https://app.almtrace.com').origin;
        const url = `${baseUrl}:${OSMAND_PORT}/?id=${selectedDevice.uniqueId}&lat=${latitude}&lon=${longitude}&timestamp=${Math.floor(position.timestamp / 1000)}&hdop=${accuracy}&altitude=${altitude || 0}&speed=${speed || 0}&bearing=${heading || 0}`;

        try {
          const response = await fetch(url, { method: 'POST' });
          if (!response.ok) {
            throw new Error(`Server responded with status ${response.status}`);
          }
          console.log("Location updated successfully:", new Date().toLocaleTimeString());
        } catch (e: any) {
          console.error("Failed to send location update:", e);
          setError(`Failed to send update: ${e.message}. Retrying...`);
          setStatus("error");
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        let errorMessage = "An unknown geolocation error occurred.";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Location permission was denied. Please enable it in your browser settings.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information is unavailable.";
            break;
          case error.TIMEOUT:
            errorMessage = "The request to get user location timed out.";
            break;
        }
        setError(errorMessage);
        setStatus("error");
        stopTracking();
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const handleDeviceSelect = (deviceId: string) => {
    const device = devices.find(d => d.id.toString() === deviceId);
    setSelectedDevice(device || null);
  };

  useEffect(() => {
    // Cleanup on component unmount
    return () => {
      stopTracking();
    };
  }, []);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Phone Tracking</CardTitle>
          <CardDescription>Apne phone ko ek tracking device ke tor par istemal karain.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Device Select Karain</label>
            <p className="text-sm text-muted-foreground">
              Wo device select karain jisay aap is phone ki location report karne ke liye istemal karna chahte hain.
            </p>
            {loadingDevices ? (
              <div className="flex items-center justify-center h-10">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <Select onValueChange={handleDeviceSelect} disabled={isTracking}>
                <SelectTrigger>
                  <SelectValue placeholder="Device select karain..." />
                </SelectTrigger>
                <SelectContent>
                  {devices.map(device => (
                    <SelectItem key={device.id} value={device.id.toString()}>
                      <div className="flex items-center gap-2">
                        <Car className="h-4 w-4" />
                        {device.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          
          <hr className="my-4" />

          {error && (
             <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {status === 'tracking' && (
             <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Tracking Active</AlertTitle>
                <AlertDescription>
                    Aapki location report ho rahi hai.
                    {lastUpdate && (
                        <span className="block mt-2 flex items-center text-xs">
                            <Clock className="h-3 w-3 mr-1.5"/> Last update: {lastUpdate.toLocaleTimeString()}
                        </span>
                    )}
                </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-center pt-4">
            {!isTracking ? (
              <Button
                className="h-20 w-48 text-lg flex-col gap-2"
                onClick={startTracking}
                disabled={!selectedDevice || loadingDevices}
              >
                <Power className="h-8 w-8" />
                Start Tracking
              </Button>
            ) : (
              <Button
                variant="destructive"
                className="h-20 w-48 text-lg flex-col gap-2"
                onClick={stopTracking}
              >
                <PowerOff className="h-8 w-8" />
                Stop Tracking
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
