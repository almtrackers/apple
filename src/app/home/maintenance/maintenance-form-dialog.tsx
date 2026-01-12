"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  Droplet, 
  Wrench, 
  Circle, 
  Gauge, 
  Settings, 
  Battery, 
  Filter, 
  Thermometer,
  MoreHorizontal,
  Gauge as GaugeIcon,
  Calendar,
  Clock,
  Activity
} from "lucide-react";
import { useWebSocket } from "@/contexts/websocket-context";
import apiClient from "@/lib/api";

interface MaintenanceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: any;
  onSuccess?: () => void;
}

const MAINTENANCE_TYPES = [
  "Engine Oil",
  "Tire Replacement",
  "Brake Service",
  "Engine Service",
  "Transmission Service",
  "Battery Replacement",
  "Filter Replacement",
  "Coolant Flush",
  "General Service",
  "Other",
] as const;

// Icon mapping for maintenance types
const MAINTENANCE_TYPE_ICONS: Record<string, typeof Droplet> = {
  "Engine Oil": Droplet,
  "Tire Replacement": Circle,
  "Brake Service": Gauge,
  "Engine Service": Wrench,
  "Transmission Service": Settings,
  "Battery Replacement": Battery,
  "Filter Replacement": Filter,
  "Coolant Flush": Thermometer,
  "General Service": Wrench,
  "Other": MoreHorizontal,
};

// Icon mapping for period units
const PERIOD_UNIT_ICONS: Record<string, typeof Clock> = {
  "km": GaugeIcon,
  "days": Calendar,
  "months": Calendar,
  "hours": Clock,
  "engineHours": Activity,
};

const PERIOD_UNITS = [
  { value: "km", label: "Kilometers (km)", icon: GaugeIcon },
  { value: "days", label: "Days", icon: Calendar },
  { value: "months", label: "Months", icon: Calendar },
  { value: "hours", label: "Hours", icon: Clock },
  { value: "engineHours", label: "Engine Hours", icon: Activity },
] as const;

export default function MaintenanceFormDialog({
  open,
  onOpenChange,
  task,
  onSuccess,
}: MaintenanceFormDialogProps) {
  const { devices: devicesMap } = useWebSocket();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  // Form fields
  const [deviceId, setDeviceId] = useState<number | null>(null);
  const [type, setType] = useState("");
  const [start, setStart] = useState<number>(0);
  const [period, setPeriod] = useState<number>(0);
  const [periodUnit, setPeriodUnit] = useState<string>("km");
  const [attributesJson, setAttributesJson] = useState("{}");
  
  // Track existing maintenance types for the selected device
  const [existingMaintenanceTypes, setExistingMaintenanceTypes] = useState<Set<string>>(new Set());
  const [loadingMaintenances, setLoadingMaintenances] = useState(false);

  const devices = Object.values(devicesMap);

  const selectedDevice = useMemo(
    () => devices.find((d) => d.id === deviceId) || null,
    [devices, deviceId]
  );

  const currentOdometer = useMemo(() => {
    const distance = 
      selectedDevice?.position?.attributes?.totalDistance ||
      selectedDevice?.attributes?.totalDistance ||
      0;
    // Convert from meters to km and round to integer
    return Math.round(distance / 1000);
  }, [selectedDevice]);

  const currentEngineHours = useMemo(() => {
    // Read engine runtime from attributes.hours (in milliseconds)
    const engineRuntimeMs = 
      selectedDevice?.position?.attributes?.hours ||
      selectedDevice?.attributes?.hours ||
      0;
    // Convert from milliseconds to hours and round to integer
    return Math.round(engineRuntimeMs / (1000 * 60 * 60));
  }, [selectedDevice]);

  // Reset form when dialog opens/closes or task changes
  useEffect(() => {
    if (open) {
      if (task) {
        // Edit mode
        setDeviceId(task.deviceId || null);
        setType(task.type || "");
        setStart(Math.round(task.start || 0));
        setPeriod(Math.round(task.period || 0));
        setPeriodUnit(task.attributes?.periodUnit || "km");
        setAttributesJson(
          task.attributes ? JSON.stringify(task.attributes, null, 2) : "{}"
        );
      } else {
        // Create mode - reset form
        setDeviceId(null);
        setType("");
        setStart(0);
        setPeriod(0);
        setPeriodUnit("km");
        setAttributesJson("{}");
      }
    }
  }, [open, task]);

  // Fetch existing maintenance records for the selected device
  useEffect(() => {
    const fetchExistingMaintenances = async () => {
      if (!deviceId || task) {
        // Skip if no device selected or in edit mode
        setExistingMaintenanceTypes(new Set());
        return;
      }

      setLoadingMaintenances(true);
      try {
        // Try singular endpoint first, fallback to plural
        let response;
        try {
          response = await apiClient.get("/maintenance");
        } catch (err: any) {
          if (err.response?.status === 404 || err.message?.includes("Network Error")) {
            // Fallback to plural endpoint
            response = await apiClient.get("/maintenances");
          } else {
            throw err;
          }
        }

        const allMaintenances = Array.isArray(response.data) ? response.data : [];
        
        // Filter maintenances for the selected device
        // Check deviceId from id, deviceId, or attributes.deviceId
        const deviceMaintenances = allMaintenances.filter((m: any) => {
          const maintenanceDeviceId = m.deviceId || m.attributes?.deviceId || m.id;
          return Number(maintenanceDeviceId) === Number(deviceId);
        });

        // Extract existing maintenance types
        const existingTypes = new Set(
          deviceMaintenances.map((m: any) => m.type).filter(Boolean)
        );
        
        setExistingMaintenanceTypes(existingTypes);
      } catch (error) {
        console.error("Failed to fetch existing maintenances:", error);
        // Don't show error toast - just continue with empty set
        setExistingMaintenanceTypes(new Set());
      } finally {
        setLoadingMaintenances(false);
      }
    };

    if (open) {
      fetchExistingMaintenances();
    }
  }, [deviceId, open, task]);

  // Clear type selection if it becomes unavailable after device/maintenance data changes
  useEffect(() => {
    if (!task && deviceId && type && existingMaintenanceTypes.has(type)) {
      setType("");
      toast({
        variant: "default",
        title: "Notice",
        description: `This device already has a "${type}" maintenance record. Please select a different type.`,
      });
    }
  }, [existingMaintenanceTypes, type, deviceId, task, toast]);

  // Update start value when device is selected (only in create mode)
  useEffect(() => {
    if (open && !task && selectedDevice) {
      if (periodUnit === "km" && currentOdometer > 0) {
        setStart(currentOdometer);
      } else if (periodUnit === "engineHours" && currentEngineHours > 0) {
        setStart(currentEngineHours);
      } else if (periodUnit !== "km" && periodUnit !== "engineHours") {
        // For time-based maintenance (days, months, hours), set start to 0 (timestamp will be used)
        setStart(0);
      }
    }
  }, [open, task, selectedDevice, currentOdometer, currentEngineHours, periodUnit]);

  // Get available maintenance types (exclude already created types for this device)
  const availableMaintenanceTypes = useMemo(() => {
    if (task) {
      // In edit mode, show all types (including current type)
      return MAINTENANCE_TYPES;
    }
    // In create mode, filter out existing types
    return MAINTENANCE_TYPES.filter((type) => !existingMaintenanceTypes.has(type));
  }, [existingMaintenanceTypes, task]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!deviceId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a vehicle.",
      });
      return;
    }

    if (!type) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a maintenance type.",
      });
      return;
    }

    // Prevent duplicate maintenance types for the same device
    if (!task && existingMaintenanceTypes.has(type)) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `This device already has a "${type}" maintenance record. Please select a different type.`,
      });
      return;
    }

    if ((periodUnit === "km" || periodUnit === "engineHours") && start < 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: periodUnit === "km" 
          ? "Start odometer reading must be a positive number."
          : "Start engine hours must be a positive number.",
      });
      return;
    }

    if (period <= 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Period must be greater than zero.",
      });
      return;
    }

    // Parse attributes JSON
    let attributes = {};
    try {
      attributes = attributesJson.trim() ? JSON.parse(attributesJson) : {};
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Invalid JSON format in attributes field.",
      });
      return;
    }

    setLoading(true);
    try {
      // Auto-generate name from vehicle name + maintenance type
      const maintenanceName = selectedDevice 
        ? `${selectedDevice.name} - ${type}`
        : type;

      // For time-based maintenance, start is 0 (timestamp is used)
      // For km-based maintenance, start is the odometer reading
      // For engine hours-based maintenance, start is the engine hours reading
      const startValue = (periodUnit === "km" || periodUnit === "engineHours") ? Math.round(start) : 0;
      
      const payload = {
        id: deviceId, // Device ID (required by API spec - this is the device ID)
        name: maintenanceName,
        type,
        start: startValue, // Odometer for km-based, 0 for time-based
        period: Math.round(period), // Ensure integer value
        attributes: {
          ...attributes,
          deviceId: deviceId, // Store deviceId in attributes for fetching positions later via /api/positions?deviceId=X
          deviceName: selectedDevice?.name || "", // Store device name for reference
          periodUnit: periodUnit, // Store period unit (km, days, months, hours)
          startTimestamp: new Date().toISOString(), // Store creation timestamp for time-based maintenance
          installationDate: new Date().toISOString(), // Store installation/creation date
        },
      };

      // Create maintenance record (use singular endpoint to match API spec)
      const response = await apiClient.post("/maintenance", payload);
      const createdMaintenance = response.data;

      // Link maintenance to device via permissions
      if (createdMaintenance && createdMaintenance.id) {
        try {
          const maintenanceId = createdMaintenance.id;
          
          // Create permission to link maintenance with device
          await apiClient.post("/permissions", {
            deviceId: deviceId,
            maintenanceId: maintenanceId,
          });
        } catch (permissionError: any) {
          console.error("Failed to link maintenance to device via permissions:", permissionError);
          // Log but don't fail - maintenance is created, just not linked via permissions
          toast({
            variant: "default",
            title: "Warning",
            description: "Maintenance created but failed to link to device. The record was still saved.",
          });
        }
      }

      toast({
        title: "Success",
        description: `Maintenance "${maintenanceName}" created and linked to device successfully.`,
      });

      onOpenChange(false);
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error("Failed to create maintenance:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error.response?.data?.message || "Failed to create maintenance.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {task ? "Edit Maintenance" : "Create New Maintenance"}
          </DialogTitle>
          <DialogDescription>
            Set up a maintenance schedule for your vehicle. Track service
            intervals based on distance or time.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="device">Vehicle *</Label>
            <Select
              value={deviceId?.toString() || ""}
              onValueChange={(value) => {
                setDeviceId(parseInt(value));
                // Clear type selection when device changes (to prevent invalid selection)
                if (!task) {
                  setType("");
                }
              }}
              disabled={!!task} // Disable if editing
            >
              <SelectTrigger id="device">
                <SelectValue placeholder="Select a vehicle" />
              </SelectTrigger>
              <SelectContent>
                {devices.map((device) => (
                  <SelectItem key={device.id} value={device.id.toString()}>
                    {device.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Maintenance Type *</Label>
            <Select 
              value={type} 
              onValueChange={setType} 
              required
              disabled={!deviceId || loadingMaintenances}
            >
              <SelectTrigger id="type">
                <SelectValue 
                  placeholder={
                    !deviceId 
                      ? "Select a vehicle first" 
                      : loadingMaintenances 
                      ? "Loading..." 
                      : "Select maintenance type"
                  }
                >
                  {type && (
                    <div className="flex items-center gap-2">
                      {(() => {
                        const IconComponent = MAINTENANCE_TYPE_ICONS[type] || MoreHorizontal;
                        return <IconComponent className="h-4 w-4" />;
                      })()}
                      <span>{type}</span>
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {availableMaintenanceTypes.length === 0 ? (
                  <SelectItem value="no-types" disabled>
                    All maintenance types have been created for this device
                  </SelectItem>
                ) : (
                  availableMaintenanceTypes.map((maintenanceType) => {
                    const IconComponent = MAINTENANCE_TYPE_ICONS[maintenanceType] || MoreHorizontal;
                    return (
                      <SelectItem key={maintenanceType} value={maintenanceType}>
                        <div className="flex items-center gap-2">
                          <IconComponent className="h-4 w-4" />
                          <span>{maintenanceType}</span>
                        </div>
                      </SelectItem>
                    );
                  })
                )}
              </SelectContent>
            </Select>
            {!deviceId && (
              <p className="text-xs text-muted-foreground">
                Please select a vehicle first to see available maintenance types.
              </p>
            )}
            {deviceId && availableMaintenanceTypes.length === 0 && !task && (
              <p className="text-xs text-yellow-600">
                All maintenance types have already been created for this device. Please delete an existing maintenance to create a new one.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 items-start">
            <div>
              <Label htmlFor="start" className="block mb-1">
                {periodUnit === "km" 
                  ? "Start Odometer (km)" 
                  : periodUnit === "engineHours"
                  ? "Start Engine Hours"
                  : "Start Value"} *
              </Label>
              {selectedDevice && periodUnit === "km" && (
                <p className="text-xs text-muted-foreground mb-2 h-10 flex items-center">
                  Current: {currentOdometer} km
                </p>
              )}
              {selectedDevice && periodUnit === "engineHours" && (
                <p className="text-xs text-muted-foreground mb-2 h-10 flex items-center">
                  Current: {currentEngineHours} hrs
                </p>
              )}
              {periodUnit !== "km" && periodUnit !== "engineHours" && (
                <p className="text-xs text-muted-foreground mb-2 h-10 flex items-center">
                  Current time will be used as start
                </p>
              )}
              {!selectedDevice && (
                <div className="h-10 mb-2"></div>
              )}
              <Input
                id="start"
                type="number"
                min="0"
                step="1"
                placeholder={periodUnit === "km" ? "0" : periodUnit === "engineHours" ? "0" : "0"}
                value={start}
                onChange={(e) => {
                  const value = e.target.value;
                  // Only accept integers, ignore decimal values
                  const intValue = value.includes('.') 
                    ? Math.floor(parseFloat(value) || 0)
                    : Math.round(parseInt(value) || 0);
                  setStart(intValue >= 0 ? intValue : 0);
                }}
                onBlur={(e) => {
                  // Ensure value is integer on blur
                  const intValue = Math.round(parseFloat(e.target.value) || 0);
                  setStart(intValue >= 0 ? intValue : 0);
                }}
                disabled={periodUnit !== "km" && periodUnit !== "engineHours"} // Disable for time-based maintenance (uses current time)
                required
              />
            </div>

            <div>
              <Label htmlFor="period" className="block mb-2">
                Period *
              </Label>
              <Select value={periodUnit} onValueChange={setPeriodUnit}>
                <SelectTrigger className="w-full mb-2">
                  <SelectValue>
                    {periodUnit && PERIOD_UNITS.find(u => u.value === periodUnit) && (
                      <div className="flex items-center gap-2">
                        {(() => {
                          const unit = PERIOD_UNITS.find(u => u.value === periodUnit);
                          const IconComponent = unit?.icon || Clock;
                          return <IconComponent className="h-4 w-4" />;
                        })()}
                        <span>{PERIOD_UNITS.find(u => u.value === periodUnit)?.label || periodUnit}</span>
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_UNITS.map((unit) => {
                    const IconComponent = unit.icon;
                    return (
                      <SelectItem key={unit.value} value={unit.value}>
                        <div className="flex items-center gap-2">
                          <IconComponent className="h-4 w-4" />
                          <span>{unit.label}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <Input
                id="period"
                type="number"
                min="1"
                step="1"
                placeholder="e.g., 10000"
                value={period}
                onChange={(e) => {
                  const value = e.target.value;
                  // Only accept integers, ignore decimal values
                  const intValue = value.includes('.') 
                    ? Math.floor(parseFloat(value) || 0)
                    : Math.round(parseInt(value) || 0);
                  setPeriod(intValue > 0 ? intValue : 0);
                }}
                onBlur={(e) => {
                  // Ensure value is integer on blur
                  const intValue = Math.round(parseFloat(e.target.value) || 0);
                  setPeriod(intValue > 0 ? intValue : 0);
                }}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="attributes">
              Attributes (JSON)
              <span className="text-xs text-muted-foreground ml-2">
                Optional additional data
              </span>
            </Label>
            <Textarea
              id="attributes"
              placeholder='{"notes": "Service performed by mechanic", "cost": 150}'
              value={attributesJson}
              onChange={(e) => setAttributesJson(e.target.value)}
              rows={4}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Enter valid JSON format. Leave empty or use {} for no additional
              attributes.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {task ? "Update" : "Create"} Maintenance
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
