
"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { Loader2, AlertCircle, Power, PowerOff, MapPin, LogIn, LogOut, Gauge } from "lucide-react";
import { useWebSocket } from "@/contexts/websocket-context";

interface EnrichedEvent {
    id: number;
    deviceId: number;
    type: string;
    serverTime: string;
    positionId: number;
    geofenceId: number;
    attributes: any;
    deviceName: string;
    geofenceName?: string;
}

const eventIcons: { [key: string]: React.ElementType } = {
    deviceOnline: Power,
    deviceOffline: PowerOff,
    geofenceEnter: LogIn,
    geofenceExit: LogOut,
    alarm: AlertCircle,
    speeding: Gauge,
    default: AlertCircle,
};

const eventColors: { [key: string]: string } = {
    deviceOnline: 'bg-green-500',
    deviceOffline: 'bg-red-500',
    geofenceEnter: 'bg-blue-500',
    geofenceExit: 'bg-orange-500',
    alarm: 'bg-destructive',
    speeding: 'bg-yellow-500',
    default: 'bg-gray-500',
}

const formatEventType = (type: string) => {
    if (!type) return 'Unknown Event';
    // Handle camelCase by adding spaces
    return type
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (str) => str.toUpperCase());
}

export default function EventsPage() {
  const { events, isLoading } = useWebSocket();

  const getEventTitle = (event: EnrichedEvent) => {
      let speedKmh = 0;
      if (event.type === 'alarm' && event.attributes?.alarm === 'speeding') {
          speedKmh = (event.attributes?.speed || 0) * 1.852;
          return `Speeding: ${speedKmh.toFixed(0)} km/h`;
      }
      if (event.type === 'speeding' && event.attributes?.speed) {
          speedKmh = event.attributes.speed * 1.852;
          return `Speeding: ${speedKmh.toFixed(0)} km/h`;
      }
      const formattedType = formatEventType(event.type);
      if (event.type === 'geofenceEnter' || event.type === 'geofenceExit') {
          return `${formattedType}: ${event.geofenceName || 'Unnamed Area'}`;
      }
      return formattedType;
  }

  return (
    <Card className="h-full flex flex-col">
       <CardHeader>
        <div className="flex justify-between items-center">
            <div>
                <CardTitle>Recent Events</CardTitle>
                <CardDescription>Showing last 25 real-time events.</CardDescription>
            </div>
        </div>
       </CardHeader>
      <CardContent className="flex-grow flex flex-col">
        <ScrollArea className="flex-grow">
            {isLoading ? (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
            ) : events.length > 0 ? (
            <div className="relative pl-6">
                <div className="absolute left-0 top-0 bottom-0 w-px bg-border translate-x-[18px]"></div>
                {events.map((event) => {
                    const Icon = eventIcons[event.type] || eventIcons.default;
                    const color = eventColors[event.type] || eventColors.default;
                    const eventDate = event.serverTime ? new Date(event.serverTime) : null;
                    return (
                        <div key={event.id} className="relative flex items-start gap-4 mb-6">
                            <div className={`mt-1 flex-shrink-0 h-8 w-8 rounded-full ${color} flex items-center justify-center text-white`}>
                            <Icon className="h-5 w-5" />
                            </div>
                            <div className="flex-grow">
                                <p className="font-semibold">{getEventTitle(event)}</p>
                                <p className="font-medium text-sm text-foreground/80">{event.deviceName}</p>
                                <p className="text-sm text-muted-foreground">{eventDate ? format(eventDate, 'PPP p') : 'Time not available'}</p>
                            </div>
                        </div>
                    )
                })}
            </div>
            ) : (
            <div className="text-center py-16 text-muted-foreground h-full flex flex-col justify-center items-center">
                <MapPin className="h-12 w-12 mx-auto mb-4" />
                <p className="font-semibold text-lg">No Events Found</p>
                <p>Waiting for real-time events...</p>
            </div>
            )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
