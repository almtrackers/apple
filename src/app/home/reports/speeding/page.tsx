
"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { Loader2, AlertCircle, Gauge, Car } from "lucide-react";
import apiClient from "@/lib/api";
import { DateRange } from "react-day-picker";
import { ReportHeader } from "@/components/home/report-header";

interface TraccarEvent {
    id: number;
    deviceId: number;
    type: string;
    serverTime: string;
    attributes: {
        speed?: number;
    };
}

interface Device {
    id: number;
    name: string;
}

interface EnrichedEvent extends TraccarEvent {
    deviceName: string;
}

export default function SpeedingReportPage() {
  const [events, setEvents] = useState<EnrichedEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("all");
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(new Date().setDate(new Date().getDate() - 1)),
    to: new Date(),
  });

  const fetchSpeedingEvents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
        if (devices.length === 0) {
             const devicesResponse = await apiClient.get<Device[]>('/devices');
             setDevices(devicesResponse.data || []);
        }

      const deviceMap = new Map(devices.map(d => [d.id, d.name]));

      const from = date?.from ? date.from : new Date(new Date().setDate(new Date().getDate() - 1));
      const to = date?.to ? date.to : new Date();

      from.setHours(0,0,0,0);
      to.setHours(23,59,59,999);

      const params = new URLSearchParams();
      if (selectedDeviceId === "all") {
        devices.forEach(device => params.append('deviceId', device.id.toString()));
      } else {
        params.append('deviceId', selectedDeviceId);
      }
      params.append('from', from.toISOString());
      params.append('to', to.toISOString());
      params.append('type', 'speeding');
      params.append('type', 'speedLimit');


      const eventsResponse = await apiClient.get<TraccarEvent[]>(`/reports/events?${params.toString()}`);
      
      const enrichedEvents = (eventsResponse.data || [])
        .map(event => ({
            ...event,
            deviceName: deviceMap.get(event.deviceId) || 'Unknown Device',
        }))
        .sort((a, b) => new Date(b.serverTime).getTime() - new Date(a.serverTime).getTime());

      setEvents(enrichedEvents);

    } catch (err) {
      console.error("Failed to fetch events", err);
      setError("Failed to load speeding events. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [date, selectedDeviceId, devices]);

  useEffect(() => {
    fetchSpeedingEvents();
  }, [fetchSpeedingEvents]);

  return (
    <Card className="h-full flex flex-col">
      <ReportHeader
        title="Speeding Report"
        description="Review speeding events for your devices"
        devices={devices}
        selectedDeviceId={selectedDeviceId}
        onDeviceChange={setSelectedDeviceId}
        date={date}
        onDateChange={setDate}
        onRefresh={fetchSpeedingEvents}
        loading={loading}
        showExport={true}
        onExport={() => {
          // TODO: Implement export functionality
          console.log("Export speeding report");
        }}
      />
      <CardContent className="flex-grow flex flex-col">
        <ScrollArea className="flex-grow">
            {loading ? (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
            ) : error ? (
            <div className="text-center py-16 text-destructive h-full flex flex-col justify-center items-center">
                <AlertCircle className="h-12 w-12 mx-auto mb-4" />
                <p className="font-semibold text-lg">Error</p>
                <p>{error}</p>
            </div>
            ) : events.length > 0 ? (
            <div className="relative pl-6">
                <div className="absolute left-0 top-0 bottom-0 w-px bg-border translate-x-[18px]"></div>
                {events.map((event) => {
                    const speedKmh = (event.attributes?.speed || 0) * 1.852;
                    return (
                        <div key={event.id} className="relative flex items-start gap-4 mb-6">
                             <div className="mt-1 flex-shrink-0 h-8 w-8 rounded-full bg-yellow-500 flex items-center justify-center text-white">
                                <Gauge className="h-5 w-5" />
                            </div>
                            <div className="flex-grow">
                                <p className="font-semibold">
                                    Speeding: <span className="text-red-600">{speedKmh.toFixed(0)} km/h</span>
                                </p>
                                <p className="font-medium text-sm text-foreground/80 flex items-center gap-2">
                                    <Car className="h-4 w-4"/>
                                    {event.deviceName}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {format(new Date(event.serverTime), 'PPP p')}
                                </p>
                            </div>
                        </div>
                    )
                })}
            </div>
            ) : (
            <div className="text-center py-16 text-muted-foreground h-full flex flex-col justify-center items-center">
                <Gauge className="h-12 w-12 mx-auto mb-4" />
                <p className="font-semibold text-lg">No Speeding Events</p>
                <p>No speeding events were found for the selected criteria.</p>
            </div>
            )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
