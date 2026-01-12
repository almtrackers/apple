
"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Map as GoogleMap, useMap, AdvancedMarker } from '@vis.gl/react-google-maps';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Car, MapPin } from 'lucide-react';
import apiClient from '@/lib/api';
import { MapProvider } from '@/app/home/map/map-provider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import { useWebSocket } from '@/contexts/websocket-context';
import { mapParsedGeofence, ParsedGeofence } from '@/lib/geofences';

interface Device {
  id: number;
  name: string;
  status?: string;
  position?: {
    latitude: number;
    longitude: number;
    course?: number;
  };
}

function GeofenceMap({ geofences, onMarkerClick, selectedGeofence, selectedDevice, allDevices }: {
  geofences: ParsedGeofence[],
  onMarkerClick: (geofence: ParsedGeofence) => void,
  selectedGeofence: ParsedGeofence | null,
  selectedDevice: Device | null,
  allDevices: Device[]
}) {
  const map = useMap();
  const circlesRef = useRef<google.maps.Circle[]>([]);
  const selectedOverlayRef = useRef<google.maps.Polygon | google.maps.Polyline | null>(null);
  
  // Filter devices with valid positions
  const devicesWithPositions = useMemo(() => 
    allDevices.filter(d => d.position?.latitude && d.position?.longitude),
    [allDevices]
  );

  // draw circles for circle-type geofences
  useEffect(() => {
    if (!map) return;
    circlesRef.current.forEach(c => c.setMap(null));
    circlesRef.current = [];

    geofences.forEach(g => {
      if (!g.center || !g.radius) return;
      const isSelected = selectedGeofence?.id === g.id;
      const circle = new google.maps.Circle({
        strokeColor: isSelected ? '#0000FF' : '#FF0000',
        strokeOpacity: 0.8,
        strokeWeight: isSelected ? 3 : 2,
        fillColor: isSelected ? '#0000FF' : '#FF0000',
        fillOpacity: 0.35,
        map,
        center: g.center,
        radius: g.radius,
      });
      circle.addListener('click', () => onMarkerClick(g));
      circlesRef.current.push(circle);
    });

    return () => { circlesRef.current.forEach(c => c.setMap(null)); };
  }, [geofences, map, onMarkerClick, selectedGeofence]);

  // draw selected polygon/line on click
  useEffect(() => {
    if (!map) return;

    if (selectedOverlayRef.current) {
      selectedOverlayRef.current.setMap(null);
      selectedOverlayRef.current = null;
    }

    if (!selectedGeofence) return;

    if (selectedGeofence.geometry === 'POLYGON' && selectedGeofence.path?.length) {
      const polygon = new google.maps.Polygon({
        paths: selectedGeofence.path,
        strokeColor: '#0000FF',
        strokeOpacity: 0.9,
        strokeWeight: 3,
        fillColor: '#0000FF',
        fillOpacity: 0.15,
      });
      polygon.setMap(map);
      selectedOverlayRef.current = polygon;

      const bounds = new google.maps.LatLngBounds();
      selectedGeofence.path.forEach(p => bounds.extend(p));
      if (!bounds.isEmpty()) map.fitBounds(bounds, 50);
      return;
    }

    if (selectedGeofence.geometry === 'LINESTRING' && selectedGeofence.path?.length) {
      const polyline = new google.maps.Polyline({
        path: selectedGeofence.path,
        strokeColor: '#0000FF',
        strokeOpacity: 0.9,
        strokeWeight: 4,
      });
      polyline.setMap(map);
      selectedOverlayRef.current = polyline;

      const bounds = new google.maps.LatLngBounds();
      selectedGeofence.path.forEach(p => bounds.extend(p));
      if (!bounds.isEmpty()) map.fitBounds(bounds, 50);
      return;
    }

    // fallback (circle selection handled by circles effect)
    if (selectedGeofence.center) {
      map.panTo(selectedGeofence.center);
      map.setZoom(15);
    }
  }, [selectedGeofence, map]);

  // initial fit for any circle centers and device positions
  useEffect(() => {
    if (!map || selectedGeofence) return;
    const bounds = new google.maps.LatLngBounds();
    geofences.forEach(g => { if (g.center) bounds.extend(g.center); });
    // Add device positions to bounds
    devicesWithPositions.forEach(d => {
      if (d.position) {
        bounds.extend({ lat: d.position.latitude, lng: d.position.longitude });
      }
    });
    if (!bounds.isEmpty()) map.fitBounds(bounds, 50);
    else { map.setCenter({ lat: 24.8607, lng: 67.0011 }); map.setZoom(12); }
  }, [geofences, map, selectedGeofence, selectedDevice, devicesWithPositions]);

  return (
    <GoogleMap
      defaultCenter={{ lat: 24.8607, lng: 67.0011 }}
      defaultZoom={12}
      gestureHandling="greedy"
      disableDefaultUI
      mapId="geofence-map"
      style={{ width: '100%', height: '400px', borderRadius: '0.5rem' }}
    >
      {/* Render all device markers */}
      {devicesWithPositions.map((device) => {
        if (!device.position) return null;
        const isSelected = selectedDevice?.id === device.id;
        return (
          <AdvancedMarker
            key={device.id}
            position={{ lat: device.position.latitude, lng: device.position.longitude }}
            title={device.name}
          >
            <div 
              style={{ 
                transform: `rotate(${device.position.course || 0}deg)`,
                transition: 'transform 0.3s ease'
              }} 
              className="relative flex flex-col items-center"
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path 
                  d="M12 2L2.5 21.5L12 17L21.5 21.5L12 2Z"
                  fill={isSelected ? '#ff5722' : (device.status === 'online' ? '#2962FF' : '#9E9E9E')}
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinejoin="round" 
                />
              </svg>
              <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-white/80 text-black text-xs font-bold px-2 py-1 rounded-md whitespace-nowrap shadow-md">
                {device.name}
              </span>
            </div>
          </AdvancedMarker>
        );
      })}
    </GoogleMap>
  );
}


export default function GeofenceContentPage() {
    const { toast } = useToast();
    const { devices: devicesMap } = useWebSocket();
    const [allDevices, setAllDevices] = useState<Device[]>([]);
    const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
    const [linkedGeofences, setLinkedGeofences] = useState<ParsedGeofence[]>([]);
    const [loadingDevices, setLoadingDevices] = useState(true);
    const [loadingGeofences, setLoadingGeofences] = useState(false);
    const [selectedGeofence, setSelectedGeofence] = useState<ParsedGeofence | null>(null);
    
    // Get all devices from WebSocket context (includes positions)
    const allDevicesWithPositions = useMemo(() => {
      return Object.values(devicesMap) as Device[];
    }, [devicesMap]);

    const fetchDevices = useCallback(async () => {
        setLoadingDevices(true);
        try {
            const deviceRes = await apiClient.get<Device[]>('/devices');
            setAllDevices(deviceRes.data || []);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not load devices.' });
        } finally {
            setLoadingDevices(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchDevices();
    }, [fetchDevices]);

    const handleDeviceChange = async (deviceId: string) => {
        const device = allDevices.find(d => d.id.toString() === deviceId);
        if (!device) return;

        setSelectedDevice(device);
        setSelectedGeofence(null);
        setLinkedGeofences([]);
        setLoadingGeofences(true);

        try {
            const geofencesRes = await apiClient.get<Geofence[]>(`/geofences?deviceId=${device.id}`);
            const deviceGeofences = geofencesRes.data;
            
            const geofencesWithAreas = (deviceGeofences || []).map(mapParsedGeofence);

            setLinkedGeofences(geofencesWithAreas);

        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: `Could not load geofences for ${device.name}.` });
            console.error(error);
        } finally {
            setLoadingGeofences(false);
        }
    };
    
    const handleGeofenceListClick = (geofence: ParsedGeofence) => {
        setSelectedGeofence(geofence);
    }

    return (
        <div className="space-y-6 p-6 pt-0">
            <Card>
                <CardHeader>
                    <CardTitle>Geofence Viewer</CardTitle>
                    <CardDescription>Select a device to view its assigned geofences.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="device-select">Select a Device</Label>
                         {loadingDevices ? (
                            <div className="flex items-center justify-center h-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
                        ) : (
                        <Select onValueChange={handleDeviceChange} value={selectedDevice?.id.toString()}>
                            <SelectTrigger id="device-select">
                                <SelectValue placeholder="Select a device to view geofences..." />
                            </SelectTrigger>
                            <SelectContent>
                                {allDevices.map(d => (
                                    <SelectItem key={d.id} value={d.id.toString()}>
                                         <div className="flex items-center gap-2">
                                            <Car className="h-4 w-4" />
                                            {d.name}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        )}
                    </div>
                    
                    {selectedDevice && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="md:order-2">
                                <MapProvider>
                                    <GeofenceMap 
                                        geofences={linkedGeofences} 
                                        onMarkerClick={handleGeofenceListClick} 
                                        selectedGeofence={selectedGeofence}
                                        selectedDevice={selectedDevice}
                                        allDevices={allDevicesWithPositions}
                                    />
                                </MapProvider>
                            </div>
                            <div className="md:order-1">
                                {loadingGeofences ? (
                                    <div className="flex justify-center items-center h-[400px]"><Loader2 className="animate-spin h-8 w-8" /></div>
                                ) : (
                                    <ScrollArea className="h-[400px] pr-4">
                                        <ul className="space-y-2">
                                            {linkedGeofences.length > 0 ? linkedGeofences.map(g => (
                                                <li key={g.id} 
                                                    className={cn(
                                                        "flex flex-col p-3 rounded-lg cursor-pointer transition-colors border",
                                                        selectedGeofence?.id === g.id ? 'bg-primary/10 border-primary' : 'bg-muted hover:bg-muted/80'
                                                    )}
                                                    onClick={() => handleGeofenceListClick(g)}
                                                >
                                                    <span className="font-medium">{g.name}</span>
                                                </li>
                                            )) : (
                                                 <div className="text-center py-16 text-muted-foreground h-full flex flex-col justify-center items-center">
                                                    <MapPin className="h-12 w-12 mx-auto mb-4" />
                                                    <p className="font-semibold text-lg">No Geofences Found</p>
                                                    <p>This device is not assigned to any geofences.</p>
                                                </div>
                                            )}
                                        </ul>
                                    </ScrollArea>
                                )}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
