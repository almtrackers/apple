
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Loader2, Route, Gauge, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import apiClient from "@/lib/api";
import { DateRange } from "react-day-picker";

interface Trip {
  deviceId: number;
  distance: number;
  averageSpeed: number;
  maxSpeed: number;
  spentFuel: number;
  startTime: string;
  endTime: string;
  startAddress: string;
  endAddress: string;
  duration: number;
}

export default function HistoryPage() {
  const { user } = useAuth();
  const [selectedDevice, setSelectedDevice] = useState<any>(null);
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(new Date().setDate(new Date().getDate() - 7)),
    to: new Date(),
  });
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTrips = async () => {
    if (!selectedDevice || !date?.from || !date?.to) return;

    setLoading(true);
    setTrips([]);

    const from = new Date(date.from);
    from.setHours(0, 0, 0, 0);

    const to = new Date(date.to);
    to.setHours(23, 59, 59, 999);

    const fromISO = from.toISOString();
    const toISO = to.toISOString();

    try {
      const res = await apiClient.get(
        `/reports/trips?deviceId=${selectedDevice.id}&from=${fromISO}&to=${toISO}`
      );
      if (res.data) {
        setTrips(res.data);
      }
    } catch (error) {
      console.error("Failed to fetch trips", error);
    } finally {
      setLoading(false);
    }
  };
  
  const formatDuration = (duration: number) => {
    const seconds = Math.floor((duration / 1000) % 60);
    const minutes = Math.floor((duration / (1000 * 60)) % 60);
    const hours = Math.floor((duration / (1000 * 60 * 60)) % 24);

    const hrs = hours > 0 ? `${hours}h ` : '';
    const mins = minutes > 0 ? `${minutes}m ` : '';
    const secs = seconds > 0 ? `${seconds}s` : '';

    return hrs + mins + secs || '0s';
  }


  useEffect(() => {
    if (selectedDevice) {
        fetchTrips();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDevice]);

  return (
    <Card className="h-full flex flex-col">
       <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
                <CardTitle>Trip Report</CardTitle>
                <CardDescription>Select a date range to view trip records for {selectedDevice?.name || 'your device'}.</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                <Popover>
                    <PopoverTrigger asChild>
                    <Button
                        id="date"
                        variant={"outline"}
                        className={cn(
                        "w-full sm:w-[280px] justify-start text-left font-normal",
                        !date && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date?.from ? (
                        date.to ? (
                            <>
                            {format(date.from, "LLL dd, y")} -{" "}
                            {format(date.to, "LLL dd, y")}
                            </>
                        ) : (
                            format(date.from, "LLL dd, y")
                        )
                        ) : (
                        <span>Pick a date</span>
                        )}
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={date?.from}
                        selected={date}
                        onSelect={setDate}
                        numberOfMonths={1}
                    />
                    </PopoverContent>
                </Popover>
                <Button onClick={fetchTrips} disabled={loading} className="w-full sm:w-auto">
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Show History
                </Button>
            </div>
        </div>
       </CardHeader>
      <CardContent className="flex-grow flex flex-col">
        <ScrollArea className="flex-grow">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : trips.length > 0 ? (
            <div className="space-y-4">
              {trips.map((trip, index) => (
                <Card key={index} className="bg-card">
                  <CardHeader>
                    <CardTitle className="text-base flex justify-between items-center">
                      <span>{format(new Date(trip.startTime), "eeee, LLL dd")}</span>
                      <span className="text-sm font-normal text-muted-foreground">{format(new Date(trip.startTime), "p")} - {format(new Date(trip.endTime), "p")}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-4">
                     <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                        <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-secondary">
                            <Route className="h-6 w-6 text-primary" />
                            <span className="font-semibold">{(trip.distance / 1000).toFixed(2)} km</span>
                            <span className="text-xs text-muted-foreground">Distance</span>
                        </div>
                        <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-secondary">
                            <Clock className="h-6 w-6 text-primary" />
                            <span className="font-semibold">{formatDuration(trip.duration)}</span>
                            <span className="text-xs text-muted-foreground">Duration</span>
                        </div>
                         <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-secondary">
                            <Gauge className="h-6 w-6 text-primary" />
                            <span className="font-semibold">{(trip.maxSpeed * 1.852).toFixed(0)} km/h</span>
                            <span className="text-xs text-muted-foreground">Max Speed</span>
                        </div>
                     </div>
                    <div className="space-y-2 pt-4 mt-4 border-t border-border">
                        <p><strong>Start:</strong> {trip.startAddress || 'Address not available'}</p>
                        <p><strong>End:</strong> {trip.endAddress || 'Address not available'}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground h-full flex flex-col justify-center items-center">
              <Route className="h-12 w-12 mx-auto mb-4" />
              <p className="font-semibold text-lg">No Trips Found</p>
              <p>There are no recorded trips for the selected date range.</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
