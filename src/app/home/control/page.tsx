
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ZapOff, Zap, Loader2, Car } from "lucide-react";
import PasswordDialog from "@/components/home/password-dialog";
import { useToast } from "@/hooks/use-toast";
import apiClient from "@/lib/api";

type CommandType = "engineStop" | "engineResume";

interface Device {
  id: number;
  name: string;
  expirationTime?: string;
  attributes: {
    devicePassword?: string;
    [key: string]: any;
  };
}

export default function ControlPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [command, setCommand] = useState<CommandType | null>(null);
  const { toast } = useToast();

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

  const handleCommand = (cmd: CommandType) => {
    if (!selectedDevice) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Pehle device select karain.",
      });
      return;
    }
    // Block commands for expired devices
    if (selectedDevice.expirationTime) {
      const t = Date.parse(selectedDevice.expirationTime);
      if (!Number.isNaN(t) && Date.now() > t) {
        const msg = encodeURIComponent('how can i pay?');
        const url = `https://wa.me/923234402200?text=${msg}`;
        window.open(url, '_blank');
        return;
      }
    }
    setCommand(cmd);
    setDialogOpen(true);
  };

  const handleDeviceSelect = (deviceId: string) => {
    const device = devices.find(d => d.id.toString() === deviceId);
    setSelectedDevice(device || null);
  };

  return (
    <>
      <div className="space-y-6 max-w-2xl mx-auto">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="roman-urdu">Device Select Karain</CardTitle>
            <CardDescription className="roman-urdu">Engine control karne ke liye device chunein.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingDevices ? (
              <div className="flex items-center justify-center h-10">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <Select onValueChange={handleDeviceSelect}>
                <SelectTrigger className="roman-urdu">
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
          </CardContent>
        </Card>
        
        <Card className={`shadow-lg transition-opacity ${selectedDevice ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
          <CardHeader>
            <CardTitle className="roman-urdu">Engine Control</CardTitle>
            <CardDescription className="roman-urdu">
                {selectedDevice ? `Aap is device ko control kar rahe hain: ${selectedDevice.name}` : 'Controls ke liye device select karain.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Button
              className="h-24 text-lg bg-red-600 hover:bg-red-700 text-white flex-col gap-2 roman-urdu"
              onClick={() => handleCommand("engineStop")}
              disabled={!selectedDevice || (!!selectedDevice?.expirationTime && !Number.isNaN(Date.parse(selectedDevice.expirationTime)) && Date.now() > Date.parse(selectedDevice.expirationTime))}
            >
              <ZapOff className="h-8 w-8" />
              Engine Band Karain
            </Button>
            <Button
              className="h-24 text-lg bg-green-600 hover:bg-green-700 text-white flex-col gap-2 roman-urdu"
              onClick={() => handleCommand("engineResume")}
              disabled={!selectedDevice || (!!selectedDevice?.expirationTime && !Number.isNaN(Date.parse(selectedDevice.expirationTime)) && Date.now() > Date.parse(selectedDevice.expirationTime))}
            >
              <Zap className="h-8 w-8" />
              Engine Dobara Chalu Karain
            </Button>
          </CardContent>
        </Card>
      </div>
      {command && selectedDevice && (
        <PasswordDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          commandType={command}
          device={selectedDevice}
        />
      )}
    </>
  );
}
