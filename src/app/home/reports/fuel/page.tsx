
"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { Loader2, Droplets, Route, Car } from "lucide-react";
import apiClient from "@/lib/api";
import { DateRange } from "react-day-picker";
import { ReportHeader } from "@/components/home/report-header";

interface Trip {
  deviceId: number;
  distance: number;
  spentFuel: number;
  startTime: string;
  endTime: string;
}

interface Device {
  id: number;
  name: string;
}

interface EnrichedTrip extends Trip {
    deviceName: string;
}

export default function FuelReportPage() {
  const [trips, setTrips] = useState<EnrichedTrip[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("all");
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(new Date().setDate(new Date().getDate() - 7)),
    to: new Date(),
  });

  const fetchFuelReport = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (devices.length === 0) {
        const devicesResponse = await apiClient.get<Device[]>('/devices');
        setDevices(devicesResponse.data || []);
      }

      const deviceMap = new Map(devices.map(d => [d.id, d.name]));

      const from = date?.from ? date.from : new Date(new Date().setDate(new Date().getDate() - 7));
      const to = date?.to ? date.to : new Date();
      from.setHours(0, 0, 0, 0);
      to.setHours(23, 59, 59, 999);

      const params = new URLSearchParams();
       if (selectedDeviceId === "all") {
        devices.forEach(device => params.append('deviceId', device.id.toString()));
      } else {
        params.append('deviceId', selectedDeviceId);
      }
      params.append('from', from.toISOString());
      params.append('to', to.toISOString());

      const res = await apiClient.get<Trip[]>(`/reports/trips?${params.toString()}`);
      
      const enrichedTrips = (res.data || [])
        .filter(trip => trip.spentFuel > 0)
        .map(trip => ({
            ...trip,
            deviceName: deviceMap.get(trip.deviceId) || 'Unknown Device',
        }))
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

      setTrips(enrichedTrips);

    } catch (err) {
      console.error("Failed to fetch fuel report", err);
      setError("Failed to load fuel report. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [date, selectedDeviceId, devices]);

  useEffect(() => {
    fetchFuelReport();
  }, [fetchFuelReport]);

  return (
    <Card className="h-full flex flex-col">
      <ReportHeader
        title="Fuel Report"
        description="Review fuel consumption for your devices"
        devices={devices}
        selectedDeviceId={selectedDeviceId}
        onDeviceChange={setSelectedDeviceId}
        date={date}
        onDateChange={setDate}
        onRefresh={fetchFuelReport}
        loading={loading}
        showExport={true}
        onExport={() => {
          // TODO: Implement export functionality
          console.log("Export fuel report");
        }}
      />
      <CardContent className="flex-grow flex flex-col">
        <ScrollArea className="flex-grow">
          {loading ? (
            <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : error ? (
            <div className="text-center py-16 text-destructive"><p>{error}</p></div>
          ) : trips.length > 0 ? (
            <div className="space-y-4">
              {trips.map((trip, index) => (
                <Card key={index}>
                  <CardHeader>
                    <CardTitle className="text-base flex justify-between items-center">
                      <span className="flex items-center gap-2"><Car className="h-4 w-4" />{trip.deviceName}</span>
                      <span className="text-sm font-normal text-muted-foreground">{format(new Date(trip.startTime), "eeee, LLL dd")}</span>
                    </CardTitle>
                     <CardDescription>{format(new Date(trip.startTime), "p")} - {format(new Date(trip.endTime), "p")}</CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4 text-center">
                    <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-secondary">
                        <Route className="h-6 w-6 text-primary" />
                        <span className="font-semibold">{(trip.distance / 1000).toFixed(2)} km</span>
                        <span className="text-xs text-muted-foreground">Distance</span>
                    </div>
                    <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-secondary">
                        <Droplets className="h-6 w-6 text-primary" />
                        <span className="font-semibold">{trip.spentFuel.toFixed(2)} liters</span>
                        <span className="text-xs text-muted-foreground">Fuel Spent</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground h-full flex flex-col justify-center items-center">
              <Droplets className="h-12 w-12 mx-auto mb-4" />
              <p className="font-semibold text-lg">No Fuel Data</p>
              <p>No trips with fuel consumption data were found for the selected criteria.</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
