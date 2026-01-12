
"use client";

import React, { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Car, MapPin, Phone, Clock, Gauge, Bike, Truck, Bus, Ship, Plane, Zap, Circle, Loader2, Lock, Unlock, HelpCircle, Battery, BatteryLow, BatteryMedium, BatteryCharging, AlertTriangle, Signal, SignalHigh, SignalMedium, SignalLow } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from '@/hooks/use-toast';
import { getDeviceCategory } from '@/utils/deviceIcons';
import PasswordDialog from "@/components/home/password-dialog";
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useWebSocket, useEngineAndTow, useIgnitionStatus } from '@/contexts/websocket-context';
import apiClient from '@/lib/api';

interface Device {
  id: number;
  name: string;
  uniqueId: string;
  phone?: string;
  status: string;
  lastUpdate: string;
  expirationTime?: string;
  attributes: {
    totalDistance?: number;
    phoneRobocall?: string;
    [key: string]: any;
  };
  position?: {
    latitude: number;
    longitude: number;
    speed: number;
    course: number;
    attributes: {
        ignition?: boolean;
        batteryLevel?: number;
        blocked?: boolean;
        totalDistance?: number;
    }
  };
}

const GsmSignal = ({ rssi }: { rssi: number | undefined }) => {
    // Hide component if RSSI is undefined/null/NaN
    if (rssi === undefined || rssi === null || isNaN(rssi)) {
        return null;
    }

    let icon = <Signal className="h-4 w-4 text-gray-400" />;
    let label = "No Signal";
    
    if (rssi >= 4) {
        icon = <SignalHigh className="h-4 w-4 text-green-500" />;
        label = "Excellent Signal";
    } else if (rssi === 3) {
        icon = <SignalMedium className="h-4 w-4 text-yellow-500" />;
        label = "Good Signal";
    } else {
        icon = <SignalLow className="h-4 w-4 text-red-500" />;
        label = "Poor Signal";
    }

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div className="flex items-center gap-2">
                    {icon}
                    <span className="text-sm text-muted-foreground">{label}</span>
                </div>
            </TooltipTrigger>
            <TooltipContent>
                <p>GSM Signal Strength: {rssi}</p>
            </TooltipContent>
        </Tooltip>
    );
};

const DevicesPage: React.FC = () => {
  const [selectedDeviceForModal, setSelectedDeviceForModal] = React.useState<Device | null>(null);
  const [showEngineControlModal, setShowEngineControlModal] = React.useState(false);
  const [commandToSend, setCommandToSend] = React.useState<'engineStop' | 'engineResume' | null>(null);
  const [resettingDeviceId, setResettingDeviceId] = React.useState<number | null>(null);
  
  // Store last known battery values for each device
  const [lastKnownBattery, setLastKnownBattery] = React.useState<Record<number, {
    level: number;
    isCharging: boolean;
    timestamp: number;
  }>>({});
  
  // Store last known RSSI values for each device
  const [lastKnownRssi, setLastKnownRssi] = React.useState<Record<number, {
    rssi: number;
    timestamp: number;
  }>>({});
  
  const { toast } = useToast();
  const { selectDeviceForMap } = useAuth();
  const router = useRouter();
  const { devices: devicesMap, isLoading, isConnected } = useWebSocket();

  const devices = useMemo(() => {
    const deviceList = Object.values(devicesMap) as Device[];
    deviceList.sort((a, b) => {
      if (a.status === 'online' && b.status !== 'online') return -1;
      if (a.status !== 'online' && b.status === 'online') return 1;
      return a.name.localeCompare(b.name);
    });
    return deviceList;
  }, [devicesMap]);

  const isExpired = (device: Device) => {
    if (!device.expirationTime) return false;
    const t = Date.parse(device.expirationTime);
    if (Number.isNaN(t)) return false;
    return Date.now() > t;
  };

  const isNearExpiry = (device: Device) => {
    if (!device.expirationTime) return false;
    const expiryTime = Date.parse(device.expirationTime);
    if (Number.isNaN(expiryTime)) return false;
    const now = Date.now();
    const daysUntilExpiry = (expiryTime - now) / (1000 * 60 * 60 * 24);
    return daysUntilExpiry > 0 && daysUntilExpiry <= 7;
  };

  const shouldHighlightCard = (device: Device) => {
    // Check if EXT > 0
    const extValue = device.attributes?.EXT;
    const hasExt = extValue !== undefined && extValue !== null && Number(extValue) > 0;
    
    // Check if near expiry (within 7 days)
    const nearExpiry = isNearExpiry(device);
    
    return hasExt || nearExpiry;
  };

  // Update last known battery and RSSI values when new data arrives
  React.useEffect(() => {
    const now = Date.now();
    const updatedBattery = { ...lastKnownBattery };
    const updatedRssi = { ...lastKnownRssi };
    
    devices.forEach(device => {
      const attrs = device.position?.attributes || {};
      const batteryLevel = attrs.batteryLevel;
      const rssi = attrs.rssi;
      
      // Check for charging status
      const isCharging = attrs.charging === true || 
                        attrs.power === true || 
                        (attrs.externalVoltage && attrs.externalVoltage > 13.0) || 
                        (attrs.batteryVoltage && attrs.batteryVoltage > 13.0) ||
                        attrs.charge === true ||
                        attrs.powerConnected === true;
      
      // Only update if we have valid battery data
      if (batteryLevel !== undefined && batteryLevel !== null && !isNaN(batteryLevel)) {
        updatedBattery[device.id] = {
          level: Math.round(batteryLevel),
          isCharging,
          timestamp: now
        };
      }
      
      // Only update if we have valid RSSI data
      if (rssi !== undefined && rssi !== null && !isNaN(rssi)) {
        updatedRssi[device.id] = {
          rssi: Math.round(rssi),
          timestamp: now
        };
      }
    });
    
    setLastKnownBattery(updatedBattery);
    setLastKnownRssi(updatedRssi);
  }, [devices]);

  const getDeviceIcon = (device: Device) => {
    const category = getDeviceCategory(device);
    const iconProps = { className: "h-8 w-8 text-primary" };
    
    switch (category) {
      case 'bike': return <Bike {...iconProps} />;
      case 'motorcycle': return <Bike {...iconProps} />;
      case 'car': return <Car {...iconProps} />;
      case 'truck': return <Truck {...iconProps} />;
      case 'bus': return <Bus {...iconProps} />;
      case 'van': return <Car {...iconProps} />;
      case 'boat': return <Ship {...iconProps} />;
      case 'aircraft': return <Plane {...iconProps} />;
      case 'drone': return <Zap {...iconProps} />;
      default: return <Car {...iconProps} />;
    }
  };
  
  const handleResetCommand = async (e: React.MouseEvent, deviceId: number) => {
    e.stopPropagation();
    setResettingDeviceId(deviceId);
    try {
      const res = await apiClient.post('/commands/send', {
        deviceId: deviceId,
        type: 'custom',
        attributes: {
          data: 'RESET#',
        },
      });
      if (res.status === 200 || res.status === 202) {
        toast({
          title: "Success",
          description: "Reset ok",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to send reset command.",
        });
      }
    } catch (error) {
       toast({
          variant: "destructive",
          title: "Error",
          description: "An error occurred while sending the command.",
        });
    } finally {
        setResettingDeviceId(null);
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'online': return 'text-green-500';
      case 'offline': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getStatusText = (device: Device) => {
     if (device.status === 'online') {
         if (device.position && device.position.speed > 0) return "Moving";
         return "Online";
     }
     if (device.status === 'offline') return "Offline";
     return "Unknown";
  }

  const getRemainingValidityDays = (expirationTime?: string) => {
    if (!expirationTime) return 'N/A';
    const expiry = new Date(expirationTime);
    const today = new Date();
    const timeDiff = expiry.getTime() - today.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    
    if (daysDiff < 0) return 'Expired';
    return `${daysDiff} days left`;
  };

  const formatOdometer = (device: Device) => {
    const distance = device.position?.attributes?.totalDistance || device.attributes?.totalDistance || 0;
    return `${(distance / 1000).toFixed(2)} km`;
  }

  const getRssiValue = (device: Device) => {
    const currentRssi = device.position?.attributes?.rssi;
    
    // If we have current RSSI data, use it
    if (currentRssi !== undefined && currentRssi !== null && !isNaN(currentRssi)) {
      return currentRssi;
    }
    
    // If no current RSSI data, use last known value if available
    const lastKnown = lastKnownRssi[device.id];
    if (lastKnown) {
      return lastKnown.rssi;
    }
    
    // If no RSSI data at all, return undefined (component will hide)
    return undefined;
  }

  const getBatteryInfo = (device: Device) => {
    const attrs = device.position?.attributes || {};
    const currentBatteryLevel = attrs.batteryLevel;
    
    // Check for current charging status
    const currentIsCharging = attrs.charging === true || 
                             attrs.power === true || 
                             (attrs.externalVoltage && attrs.externalVoltage > 13.0) || 
                             (attrs.batteryVoltage && attrs.batteryVoltage > 13.0) ||
                             attrs.charge === true ||
                             attrs.powerConnected === true;
    
    // Get last known battery data
    const lastKnown = lastKnownBattery[device.id];
    
    // If we have current battery level data, use it (this will update our stored value)
    if (currentBatteryLevel !== undefined && currentBatteryLevel !== null && !isNaN(currentBatteryLevel)) {
      const level = Math.round(currentBatteryLevel);
      
      // If charging, show charging icon regardless of level
      if (currentIsCharging) {
        return {
          level: `${level}%`,
          icon: BatteryCharging,
          color: 'text-blue-500',
          bgColor: 'bg-blue-100',
          textColor: 'text-blue-600',
          isCharging: true
        };
      }
      
      // If not charging, show appropriate battery level icon
      if (level <= 20) {
        return {
          level: `${level}%`,
          icon: BatteryLow,
          color: 'text-red-500',
          bgColor: 'bg-red-100',
          textColor: 'text-red-600',
          isCharging: false
        };
      } else if (level <= 50) {
        return {
          level: `${level}%`,
          icon: BatteryMedium,
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-100',
          textColor: 'text-yellow-600',
          isCharging: false
        };
      } else {
        return {
          level: `${level}%`,
          icon: Battery,
          color: 'text-green-500',
          bgColor: 'bg-green-100',
          textColor: 'text-green-600',
          isCharging: false
        };
      }
    }
    
    // If no batteryLevel but device is charging, show 100%
    if (currentIsCharging) {
      return {
        level: '100%',
        icon: BatteryCharging,
        color: 'text-blue-500',
        bgColor: 'bg-blue-100',
        textColor: 'text-blue-600',
        isCharging: true
      };
    }
    
    // If no current battery data, use last known value if available
    if (lastKnown) {
      const level = lastKnown.level;
      const isCharging = lastKnown.isCharging;
      
      // If charging, show charging icon
      if (isCharging) {
        return {
          level: `${level}%`,
          icon: BatteryCharging,
          color: 'text-blue-500',
          bgColor: 'bg-blue-100',
          textColor: 'text-blue-600',
          isCharging: true
        };
      }
      
      // If not charging, show appropriate battery level icon
      if (level <= 20) {
        return {
          level: `${level}%`,
          icon: BatteryLow,
          color: 'text-red-500',
          bgColor: 'bg-red-100',
          textColor: 'text-red-600',
          isCharging: false
        };
      } else if (level <= 50) {
        return {
          level: `${level}%`,
          icon: BatteryMedium,
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-100',
          textColor: 'text-yellow-600',
          isCharging: false
        };
      } else {
        return {
          level: `${level}%`,
          icon: Battery,
          color: 'text-green-500',
          bgColor: 'bg-green-100',
          textColor: 'text-green-600',
          isCharging: false
        };
      }
    }
    
    // If no battery data at all, return null to hide battery component
    return null;
  }
  
  const handleEngineCommand = (e: React.MouseEvent, command: 'engineStop' | 'engineResume', device: Device) => {
    e.stopPropagation();
    if (isExpired(device)) {
      const msg = encodeURIComponent('how can i pay?');
      const url = `https://wa.me/923234402200?text=${msg}`;
      window.open(url, '_blank');
      return;
    }
    setSelectedDeviceForModal(device);
    setCommandToSend(command);
    setShowEngineControlModal(true);
  }

  const handleDeviceClick = (device: Device) => {
    if (isExpired(device)) {
      const msg = encodeURIComponent('how can i pay?');
      const url = `https://wa.me/923234402200?text=${msg}`;
      window.open(url, '_blank');
      return;
    }
    if (device.position) {
      selectDeviceForMap(device);
      router.push('/home/map');
    } else {
      toast({
        variant: "destructive",
        title: "No Location",
        description: "Is device ke liye koi location data nahi hai.",
      })
    }
  }

  const EngineStatusIcon = ({ deviceId }: { deviceId: number }) => {
    const { engineState } = useEngineAndTow(deviceId);
    const iconProps = { className: "w-5 h-5" };
    let icon, label;

    switch (engineState) {
        case 'locked':
            icon = <Lock {...iconProps} color="red" />;
            label = "Engine Locked";
            break;
        case 'unlocked':
            icon = <Unlock {...iconProps} color="green" />;
            label = "Engine Unlocked";
            break;
        default:
            icon = <HelpCircle {...iconProps} className="text-gray-400" />;
            label = "Status Unknown";
            break;
    }
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button className="focus:outline-none">{icon}</button>
            </TooltipTrigger>
            <TooltipContent><p>{label}</p></TooltipContent>
        </Tooltip>
    );
  };
  
  const IgnitionStatus = ({ deviceId }: { deviceId: number }) => {
    const isIgnitionOn = useIgnitionStatus(deviceId);
    return <span>Ignition: {isIgnitionOn ? 'On' : 'Off'}</span>;
  }

  return (
    <div className="space-y-4 h-full">
      {!isConnected && !isLoading && (
        <Alert variant="destructive">
          <AlertDescription>Real-time server se connection toot gaya. Dobara koshish ki ja rahi hai...</AlertDescription>
        </Alert>
      )}
        <TooltipProvider>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {devices.length > 0 ? (
                devices.map((device) => (
                <Card 
                    key={device.id} 
                    className={cn(
                    `p-4 transition-all hover:shadow-lg flex flex-col justify-between cursor-pointer relative`,
                    `border-l-4 ${device.status === 'online' ? 'border-l-green-500' : 'border-l-red-500'}`,
                    // Add red border for low battery
                    device.position?.attributes?.batteryLevel !== undefined && 
                    device.position?.attributes?.batteryLevel <= 20 && 
                    'border-r-4 border-r-red-500',
                    // Add yellow/orange background and ring for near expiry or EXT > 0
                    shouldHighlightCard(device) && 'bg-yellow-50 ring-2 ring-yellow-400 ring-offset-1',
                    isExpired(device) && 'opacity-50 grayscale'
                    )}
                    onClick={() => handleDeviceClick(device)}
                >
                    {isExpired(device) && (
                      <div className="absolute inset-0 pointer-events-none rounded-md">
                        <span className="absolute top-2 left-2 bg-red-600 text-white text-xs font-extrabold tracking-wider px-2 py-1 rounded">
                          EXPIRE
                        </span>
                      </div>
                    )}
                    {/* Engine Status - Top Right Corner */}
                    <div className="absolute top-3 right-3">
                        <EngineStatusIcon deviceId={device.id} />
                    </div>
                    <div>
                    {/* Low Battery Warning */}
                    {(() => {
                        const batteryInfo = getBatteryInfo(device);
                        const batteryLevel = device.position?.attributes?.batteryLevel;
                        const isCharging = device.position?.attributes?.charge === true || 
                                         device.position?.attributes?.charging === true || 
                                         device.position?.attributes?.power === true || 
                                         (device.position?.attributes?.externalVoltage && device.position.attributes.externalVoltage > 13.0) || 
                                         (device.position?.attributes?.batteryVoltage && device.position.attributes.batteryVoltage > 13.0) ||
                                         device.position?.attributes?.powerConnected === true;
                        
                        // Show warning only if battery level is available and <= 20%, and not charging
                        if (batteryLevel !== undefined && batteryLevel !== null && !isNaN(batteryLevel) && 
                            batteryLevel <= 20 && !isCharging) {
                            return (
                                <div className="mb-3 mr-12 inline-flex items-center gap-1.5 px-2 py-1 bg-red-50 border border-red-200 rounded-md">
                                    <AlertTriangle className="h-3 w-3 text-red-500 flex-shrink-0" />
                                    <span className="text-xs text-red-700 font-bold whitespace-nowrap">
                                        Low Battery Warning: {Math.round(batteryLevel)}%
                                    </span>
                                </div>
                            );
                        }
                        return null;
                    })()}
                    
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                        <button 
                            className="h-12 w-12 flex items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                            onClick={(e) => handleResetCommand(e, device.id)}
                            disabled={resettingDeviceId === device.id}
                            aria-label={`Reset ${device.name}`}
                        >
                            {resettingDeviceId === device.id ? (
                                <Loader2 className="h-6 w-6 animate-spin" />
                            ) : (
                                getDeviceIcon(device)
                            )}
                        </button>
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <span className="font-bold text-lg">
                                {device.name || 'Unnamed Device'}
                                </span>
                                <GsmSignal rssi={getRssiValue(device)} />
                            </div>
                            <div className="flex items-center gap-3">
                                {/* Device Status */}
                                <div className={cn("flex items-center gap-1.5 text-xs font-medium", getStatusColor(device.status))}>
                                    <Circle className="h-2 w-2 fill-current" />
                                    <span>{getStatusText(device)}</span>
                                </div>
                                {/* Battery Status - Parallel to Device Status */}
                                {(() => {
                                    const batteryInfo = getBatteryInfo(device);
                                    // Hide battery component if no battery data available
                                    if (!batteryInfo) return null;
                                    
                                    const BatteryIcon = batteryInfo.icon;
                                    return (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${batteryInfo.bgColor}`}>
                                                    <BatteryIcon className={`h-3 w-3 ${batteryInfo.color}`} />
                                                    <span className={`text-xs font-medium ${batteryInfo.textColor}`}>
                                                        {batteryInfo.level}
                                                    </span>
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>
                                                    {batteryInfo.isCharging ? 'Charging' : 'Battery Level'}: {batteryInfo.level}
                                                </p>
                                            </TooltipContent>
                                        </Tooltip>
                                    );
                                })()}
                            </div>
                        </div>
                        </div>
                    </div>

                    <div className="space-y-3 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            <span>{device.attributes.phoneRobocall || 'No number'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            <span>Last Update: {device.lastUpdate ? new Date(device.lastUpdate).toLocaleString() : 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Circle className="h-4 w-4 text-blue-500" />
                            <span>Validity: {getRemainingValidityDays(device.expirationTime)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Gauge className="h-4 w-4 text-orange-500" />
                            <span>Odometer: {formatOdometer(device)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Zap className="h-4 w-4 text-yellow-500" />
                            <IgnitionStatus deviceId={device.id} />
                        </div>
                    </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-4">
                    <Button 
                        variant="destructive" 
                        size="sm" 
                        disabled={isExpired(device)}
                        onClick={(e) => handleEngineCommand(e, 'engineStop', device)}
                    >
                        Engine Off
                    </Button>
                    <Button 
                        variant="default" 
                        className="bg-green-600 hover:bg-green-700" 
                        size="sm" 
                        disabled={isExpired(device)}
                        onClick={(e) => handleEngineCommand(e, 'engineResume', device)}
                    >
                        Engine On
                    </Button>
                    </div>
                </Card>
                ))
            ) : (
                <Card className="p-8 text-center md:col-span-2 lg:col-span-3">
                {isLoading ? (
                    <div className="flex flex-col items-center gap-4">
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                        <p className="text-muted-foreground">Loading devices...</p>
                    </div>
                ) : (
                    <>
                    <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="font-semibold mb-2">No devices found</h3>
                    <p className="text-muted-foreground">
                        Please add a device to your account or check your internet connection.
                    </p>
                    </>
                )}
                </Card>
            )}
            </div>
        </TooltipProvider>

        {commandToSend && selectedDeviceForModal && (
            <PasswordDialog
                open={showEngineControlModal}
                onOpenChange={setShowEngineControlModal}
                commandType={commandToSend}
                device={selectedDeviceForModal}
            />
        )}
    </div>
  );
};

export default DevicesPage;

    