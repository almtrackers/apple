"use client";

import { useState, useEffect, useMemo } from "react";
import { CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Loader2, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Plus, 
  Trash2,
  Droplet,
  Wrench,
  Circle,
  Gauge,
  Settings,
  Battery,
  Filter,
  Thermometer,
  MoreHorizontal,
  Activity,
  Calendar,
  Gauge as GaugeIcon,
  RotateCw
} from "lucide-react";
import { useWebSocket } from "@/contexts/websocket-context";
import { useToast } from "@/hooks/use-toast";
import apiClient from "@/lib/api";
import { cn } from "@/lib/utils";
import MaintenanceFormDialog from "./maintenance-form-dialog";

// Icon mapping for maintenance types (matching form dialog)
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

interface Maintenance {
  id: number; // Maintenance record ID (may also be device ID depending on API response)
  deviceId?: number; // Device ID (may be in id field or attributes.deviceId)
  name: string;
  type: string;
  start: number;
  period: number;
  attributes?: {
    deviceId?: number;
    deviceName?: string;
    periodUnit?: string; // Unit for period: km, days, months, hours
    [key: string]: any;
  };
}

interface Device {
  id: number;
  name: string;
  positionId?: number;
  attributes?: {
    totalDistance?: number;
    [key: string]: any;
  };
  position?: {
    attributes?: {
      totalDistance?: number;
      [key: string]: any;
    };
    [key: string]: any;
  };
}

interface Position {
  id: number;
  deviceId: number;
  attributes?: {
    totalDistance?: number;
    hours?: number; // Engine runtime in milliseconds
    [key: string]: any;
  };
  [key: string]: any;
}

export default function MaintenanceDashboard() {
  const { toast } = useToast();
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [maintenanceToDelete, setMaintenanceToDelete] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [maintenanceToReset, setMaintenanceToReset] = useState<any>(null);
  const [resetting, setResetting] = useState(false);

  const fetchMaintenances = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch maintenance records and devices
      const [maintenancesRes, devicesRes] = await Promise.all([
        // Try singular endpoint first (matches API spec for POST)
        apiClient.get<Maintenance[]>("/maintenance").catch((singularError: any) => {
          // If singular fails, try plural endpoint as fallback
          if (singularError.response?.status === 404 || singularError.code === 'ERR_NETWORK') {
            console.log("Trying plural endpoint as fallback...");
            return apiClient.get<Maintenance[]>("/maintenances");
          }
          throw singularError;
        }),
        apiClient.get<Device[]>("/devices"),
      ]);
      
      const maintenances = maintenancesRes.data || [];
      const devices = devicesRes.data || [];
      
      setMaintenances(maintenances);
      setDevices(devices);
      
      // Fetch positions for each unique deviceId from maintenance records
      // Get deviceId from deviceId field, attributes.deviceId, or id field
      const uniqueDeviceIds = [...new Set(
        maintenances
          .map(m => m.deviceId || m.attributes?.deviceId || m.id)
          .filter((id): id is number => id !== undefined && id !== null)
      )];
      
      if (uniqueDeviceIds.length > 0) {
        try {
          // Fetch positions for all devices in parallel
          const positionsPromises = uniqueDeviceIds.map(deviceId =>
            apiClient.get<Position[]>(`/positions?deviceId=${deviceId}`).catch(err => {
              console.warn(`Failed to fetch position for device ${deviceId}:`, err);
              return { data: [] };
            })
          );
          
          const positionsResults = await Promise.all(positionsPromises);
          
          // Create a map of deviceId to position (take the first/latest position for each device)
          const positionsMap = new Map<number, Position>();
          positionsResults.forEach((result, index) => {
            const positions = result.data || [];
            if (positions.length > 0) {
              // Get the latest position (usually the first one in the array)
              const latestPosition = positions[0];
              positionsMap.set(uniqueDeviceIds[index], latestPosition);
            }
          });
          
          // Attach positions to devices
          const devicesWithPositions = devices.map(device => ({
            ...device,
            position: positionsMap.get(device.id),
          }));
          
          setDevices(devicesWithPositions);
        } catch (positionsError) {
          console.error("Failed to fetch positions:", positionsError);
          // Continue without positions - devices will be set without position data
        }
      }
    } catch (err: any) {
      console.error("Failed to fetch data:", err);
      setError("Failed to load maintenance records.");
      setMaintenances([]);
      setDevices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaintenances();
    // Auto-refresh disabled as per user request
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Enrich maintenances with device info and calculate status
  const enrichedMaintenances = useMemo(() => {
    return maintenances
      .filter((maintenance) => maintenance.type !== "Tire Replacement") // Exclude tire maintenance - they're shown in tire dashboard only
      .map((maintenance) => {
        // Get deviceId from multiple possible locations
        const maintenanceDeviceId = maintenance.deviceId || maintenance.attributes?.deviceId || maintenance.id;
        
        // Use type-safe comparison to handle potential string/number mismatches
        const device = devices.find((d) => Number(d.id) === Number(maintenanceDeviceId));
        
        // Debug logging if device not found (helps diagnose "Unknown Device" issue)
        if (!device && maintenanceDeviceId) {
          console.warn('Device not found for maintenance:', {
            maintenanceId: maintenance.id,
            maintenanceDeviceId: maintenanceDeviceId,
            maintenanceName: maintenance.name,
            availableDeviceIds: devices.map(d => ({ id: d.id, name: d.name })),
          });
        }
        
        // Get period unit (default to km if not specified)
        const periodUnit = maintenance.attributes?.periodUnit || "km";
        
        // totalDistance is stored in meters; convert to km
        const totalDistanceMeters =
          device?.position?.attributes?.totalDistance ??
          device?.attributes?.totalDistance ??
          0;
        const currentOdometer = Math.round(totalDistanceMeters / 1000);

        // Read engine runtime from attributes.hours (in milliseconds); convert to hours
        const engineRuntimeMs =
          device?.position?.attributes?.hours ??
          device?.attributes?.hours ??
          0;
        const currentEngineHours = Math.round(engineRuntimeMs / (1000 * 60 * 60));

        const startOdometer = Math.round(maintenance.start);
        const periodValue = Math.round(maintenance.period);
        
        // Calculate end value and progress based on unit
        let endValue = 0;
        let currentValue = 0;
        let valueTraveled = 0;
        let valueRemaining = 0;
        let progress = 0;
        let isRunning = true;
        let isOverdue = false;
        let isNear = false;
        
        if (periodUnit === "km") {
          // For km-based maintenance, use odometer readings
          endValue = startOdometer + periodValue;
          currentValue = currentOdometer;
          valueTraveled = currentOdometer - startOdometer;
          valueRemaining = endValue - currentOdometer;
          progress = periodValue > 0
            ? Math.min(100, Math.max(0, (valueTraveled / periodValue) * 100))
            : 100;
          isRunning = currentOdometer < endValue;
          isOverdue = currentOdometer >= endValue;
          isNear = valueRemaining > 0 && valueRemaining <= 1000; // Within 1000 km
        } else if (periodUnit === "engineHours") {
          // For engine hours-based maintenance, use engine runtime
          endValue = startOdometer + periodValue; // startOdometer actually contains start engine hours
          currentValue = currentEngineHours;
          valueTraveled = currentEngineHours - startOdometer;
          valueRemaining = endValue - currentEngineHours;
          progress = periodValue > 0
            ? Math.min(100, Math.max(0, (valueTraveled / periodValue) * 100))
            : 100;
          isRunning = currentEngineHours < endValue;
          isOverdue = currentEngineHours >= endValue;
          isNear = valueRemaining > 0 && valueRemaining <= 50; // Within 50 engine hours
        } else if (periodUnit === "days" || periodUnit === "months" || periodUnit === "hours") {
          // For time-based maintenance, calculate from creation date or start date stored in attributes
          // If startTimestamp is stored in attributes, use it; otherwise use start as days/hours from now
          const startTimestamp = maintenance.attributes?.startTimestamp || maintenance.attributes?.createdAt;
          let startDate: Date;
          
          if (startTimestamp) {
            startDate = new Date(startTimestamp);
          } else {
            // Fallback: assume start value represents time units from creation
            const now = Date.now();
            if (periodUnit === "days") {
              startDate = new Date(now - (startOdometer * 24 * 60 * 60 * 1000));
            } else if (periodUnit === "months") {
              startDate = new Date(now - (startOdometer * 30 * 24 * 60 * 60 * 1000));
            } else {
              startDate = new Date(now - (startOdometer * 60 * 60 * 1000));
            }
          }
          
          const now = new Date();
          let elapsed = 0;
          
          if (periodUnit === "days") {
            elapsed = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          } else if (periodUnit === "months") {
            elapsed = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
          } else {
            elapsed = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60));
          }
          
          endValue = periodValue;
          currentValue = elapsed;
          valueTraveled = elapsed;
          valueRemaining = periodValue - elapsed;
          progress = periodValue > 0
            ? Math.min(100, Math.max(0, (valueTraveled / periodValue) * 100))
            : 100;
          isRunning = elapsed < periodValue;
          isOverdue = elapsed >= periodValue;
          isNear = valueRemaining > 0 && valueRemaining <= (
            periodUnit === "days" ? 7 : 
            periodUnit === "months" ? 1 : 
            24 // hours
          );
        }

        let status: "running" | "completed" | "near" | "overdue" = "running";
        if (isOverdue) status = "overdue";
        else if (isNear) status = "near";
        else if (!isRunning) status = "completed";
        else status = "running";

        return {
          ...maintenance,
          deviceName: device?.name || "Unknown Device",
          currentOdometer: periodUnit === "km" ? currentOdometer : undefined,
          currentEngineHours: periodUnit === "engineHours" ? currentEngineHours : undefined,
          currentValue,
          startOdometer,
          startValue: startOdometer,
          endOdometer: periodUnit === "km" ? endValue : undefined,
          endValue,
          distanceTraveled: periodUnit === "km" ? valueTraveled : undefined,
          distanceRemaining: periodUnit === "km" ? valueRemaining : undefined,
          valueTraveled,
          valueRemaining,
          progress,
          periodUnit,
          status,
          isRunning,
        };
      })
      .sort((a, b) => {
        // Sort by status: overdue first, then completed, then near, then running
        const statusOrder = { overdue: 0, completed: 1, near: 2, running: 3 };
        return (
          (statusOrder[a.status as keyof typeof statusOrder] ?? 4) -
          (statusOrder[b.status as keyof typeof statusOrder] ?? 4)
        );
      });
  }, [maintenances, devices]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "overdue":
        return "destructive";
      case "near":
        return "default";
      case "running":
        return "secondary";
      default:
        return "secondary";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "overdue":
        return <AlertTriangle className="h-4 w-4" />;
      case "completed":
        return <CheckCircle2 className="h-4 w-4" />;
      case "near":
        return <Clock className="h-4 w-4" />;
      case "running":
        return <CheckCircle2 className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const handleDeleteClick = (maintenanceId: number) => {
    setMaintenanceToDelete(maintenanceId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!maintenanceToDelete) return;

    setDeleting(true);
    try {
      // Find the maintenance record to get device ID
      const maintenance = maintenances.find(m => m.id === maintenanceToDelete);
      // Get deviceId from deviceId field, attributes.deviceId, or id field
      const deviceId = maintenance?.deviceId || maintenance?.attributes?.deviceId || maintenance?.id;

      // Delete permission link first (if it exists)
      if (deviceId) {
        try {
          // Try to delete permission - construct URL with query params
          const params = new URLSearchParams({
            deviceId: deviceId.toString(),
            maintenanceId: maintenanceToDelete.toString(),
          });
          await apiClient.delete(`/permissions?${params.toString()}`);
        } catch (permissionError: any) {
          // Log but continue - permission deletion is optional
          // The maintenance deletion will still proceed
          console.warn("Failed to delete permission (continuing with maintenance deletion):", permissionError);
        }
      }

      // Delete maintenance record (use singular endpoint)
      await apiClient.delete(`/maintenance/${maintenanceToDelete}`);
      
      toast({
        title: "Success",
        description: "Maintenance record deleted and unlinked from device successfully.",
      });
      setDeleteDialogOpen(false);
      setMaintenanceToDelete(null);
      fetchMaintenances();
    } catch (error: any) {
      console.error("Failed to delete maintenance:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error.response?.data?.message || "Failed to delete maintenance.",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleResetClick = (maintenance: any) => {
    setMaintenanceToReset(maintenance);
    setResetDialogOpen(true);
  };

  const handleResetConfirm = async () => {
    if (!maintenanceToReset) return;

    setResetting(true);
    try {
      // Find the enriched maintenance to get current values
      const enriched = enrichedMaintenances.find(m => m.id === maintenanceToReset.id);
      if (!enriched) {
        throw new Error("Maintenance record not found");
      }

      const periodUnit = maintenanceToReset.attributes?.periodUnit || "km";
      let newStartValue = 0;
      
      // Get current value based on period unit
      if (periodUnit === "km") {
        // Get current odometer
        const device = devices.find(d => {
          const maintenanceDeviceId = maintenanceToReset.deviceId || maintenanceToReset.attributes?.deviceId || maintenanceToReset.id;
          return Number(d.id) === Number(maintenanceDeviceId);
        });
        const totalDistanceMeters =
          device?.position?.attributes?.totalDistance ??
          device?.attributes?.totalDistance ??
          0;
        newStartValue = Math.round(totalDistanceMeters / 1000);
      } else if (periodUnit === "engineHours") {
        // Get current engine hours
        const device = devices.find(d => {
          const maintenanceDeviceId = maintenanceToReset.deviceId || maintenanceToReset.attributes?.deviceId || maintenanceToReset.id;
          return Number(d.id) === Number(maintenanceDeviceId);
        });
        const engineRuntimeMs =
          device?.position?.attributes?.hours ??
          device?.attributes?.hours ??
          0;
        newStartValue = Math.round(engineRuntimeMs / (1000 * 60 * 60));
      } else {
        // For time-based maintenance, start is 0 (timestamp will be used)
        newStartValue = 0;
      }

      // Update maintenance record - API requires specific structure
      const updatePayload = {
        id: maintenanceToReset.id,
        name: maintenanceToReset.name,
        type: maintenanceToReset.type,
        start: newStartValue,
        period: maintenanceToReset.period,
        attributes: {
          ...maintenanceToReset.attributes,
          deviceId: maintenanceToReset.deviceId || maintenanceToReset.attributes?.deviceId || maintenanceToReset.id,
          deviceName: maintenanceToReset.attributes?.deviceName || maintenanceToReset.name?.split(' - ')[0] || "",
          periodUnit: maintenanceToReset.attributes?.periodUnit || "km",
          startTimestamp: new Date().toISOString(), // Update timestamp for time-based maintenance
          installationDate: new Date().toISOString(), // Update installation date when resetting
        },
      };

      await apiClient.put(`/maintenance/${maintenanceToReset.id}`, updatePayload);
      
      toast({
        title: "Success",
        description: `Maintenance "${maintenanceToReset.name}" has been reset with current value.`,
      });
      setResetDialogOpen(false);
      setMaintenanceToReset(null);
      fetchMaintenances();
    } catch (error: any) {
      console.error("Failed to reset maintenance:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error.response?.data?.message || "Failed to reset maintenance.",
      });
    } finally {
      setResetting(false);
    }
  };

  if (loading && maintenances.length === 0) {
    return (
      <CardContent className="flex items-center justify-center h-64">
        <div className="text-center text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p>Loading maintenance records...</p>
        </div>
      </CardContent>
    );
  }

  if (error && maintenances.length === 0) {
    return (
      <CardContent className="flex items-center justify-center h-64">
        <div className="text-center text-muted-foreground">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-destructive" />
          <p>{error}</p>
          <button
            onClick={fetchMaintenances}
            className="mt-2 text-sm text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      </CardContent>
    );
  }

  if (enrichedMaintenances.length === 0 && !loading) {
    return (
      <>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Running Maintenance</h3>
              <p className="text-sm text-muted-foreground">
                No active maintenance records
              </p>
            </div>
            <Button onClick={() => setIsFormOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Maintenance
            </Button>
          </div>
          <div className="flex items-center justify-center h-64 border border-dashed rounded-lg">
            <div className="text-center text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2" />
              <p>No active maintenance records</p>
              <p className="text-sm">All maintenance tasks have been completed</p>
              <Button
                onClick={() => setIsFormOpen(true)}
                variant="outline"
                className="mt-4"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create New Maintenance
              </Button>
            </div>
          </div>
        </CardContent>
        <MaintenanceFormDialog
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          onSuccess={fetchMaintenances}
        />
      </>
    );
  }

  return (
    <>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">ALM Records</h3>
          <div className="flex items-center gap-2">
            <Button
              onClick={fetchMaintenances}
              disabled={loading}
              variant="outline"
              size="sm"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                "Refresh"
              )}
            </Button>
            <Button onClick={() => setIsFormOpen(true)} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Create
            </Button>
          </div>
        </div>

      <div className="space-y-3">
        {enrichedMaintenances.map((maintenance) => (
          <div
            key={maintenance.id}
            className={cn(
              "p-4 border rounded-lg space-y-3",
              maintenance.status === "overdue" && "border-red-500 bg-red-50 dark:bg-red-950/20",
              maintenance.status === "near" && "border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20"
            )}
          >
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {(() => {
                  const IconComponent = MAINTENANCE_TYPE_ICONS[maintenance.type] || MoreHorizontal;
                  return <IconComponent className="h-5 w-5 text-primary flex-shrink-0" />;
                })()}
                <h4 className="font-semibold flex-1">{maintenance.name}</h4>
                <Badge variant={getStatusColor(maintenance.status)}>
                  {getStatusIcon(maintenance.status)}
                  <span className="ml-1 capitalize">{maintenance.status}</span>
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  {maintenance.periodUnit && (
                    <>
                      <span className="flex items-center gap-1">
                        {(() => {
                          const IconComponent = PERIOD_UNIT_ICONS[maintenance.periodUnit] || Clock;
                          return <IconComponent className="h-3 w-3" />;
                        })()}
                        <span>{maintenance.periodUnit}</span>
                      </span>
                    </>
                  )}
                  {maintenance.attributes?.installationDate && (
                    <>
                      {maintenance.periodUnit && <span>•</span>}
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>
                          Date: {new Date(maintenance.attributes.installationDate).toLocaleDateString()}
                        </span>
                      </span>
                    </>
                  )}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                    onClick={() => handleResetClick(maintenance)}
                    title="Reset maintenance"
                  >
                    <RotateCw className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleDeleteClick(maintenance.id)}
                    title="Delete maintenance"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">
                  {maintenance.progress.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className={cn(
                    "h-2 rounded-full transition-all",
                    maintenance.status === "overdue" && "bg-red-500",
                    maintenance.status === "near" && "bg-yellow-500",
                    maintenance.status === "running" && "bg-green-500"
                  )}
                  style={{ width: `${Math.min(100, maintenance.progress)}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {maintenance.periodUnit === "km" ? (
                <>
                  <div>
                    <p className="text-muted-foreground">Start Odometer</p>
                    <p className="font-medium">{maintenance.startOdometer} km</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Current Odometer</p>
                    <p className="font-medium">{maintenance.currentOdometer} km</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Due at</p>
                    <p className="font-medium">{maintenance.endOdometer} km</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">
                      {maintenance.distanceRemaining && maintenance.distanceRemaining >= 0 ? "Remaining" : "Overdue"}
                    </p>
                    <p
                      className={cn(
                        "font-medium",
                        maintenance.distanceRemaining && maintenance.distanceRemaining < 0 && "text-red-600"
                      )}
                    >
                      {maintenance.distanceRemaining !== undefined ? `${Math.abs(maintenance.distanceRemaining)} km` : 'N/A'}
                    </p>
                  </div>
                </>
              ) : maintenance.periodUnit === "engineHours" ? (
                <>
                  <div>
                    <p className="text-muted-foreground">Start Engine Hours</p>
                    <p className="font-medium">{maintenance.startValue || 0} hrs</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Current Engine Hours</p>
                    <p className="font-medium">{maintenance.currentEngineHours || 0} hrs</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Due at</p>
                    <p className="font-medium">{maintenance.endValue} hrs</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">
                      {maintenance.valueRemaining >= 0 ? "Remaining" : "Overdue"}
                    </p>
                    <p
                      className={cn(
                        "font-medium",
                        maintenance.valueRemaining < 0 && "text-red-600"
                      )}
                    >
                      {Math.abs(maintenance.valueRemaining)} hrs
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-muted-foreground">Start</p>
                    <p className="font-medium">{maintenance.startValue || 0} {maintenance.periodUnit}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Current</p>
                    <p className="font-medium">{maintenance.currentValue || 0} {maintenance.periodUnit}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Due at</p>
                    <p className="font-medium">{maintenance.endValue} {maintenance.periodUnit}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">
                      {maintenance.valueRemaining >= 0 ? "Remaining" : "Overdue"}
                    </p>
                    <p
                      className={cn(
                        "font-medium",
                        maintenance.valueRemaining < 0 && "text-red-600"
                      )}
                    >
                      {Math.abs(maintenance.valueRemaining)} {maintenance.periodUnit}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      </CardContent>

      <MaintenanceFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSuccess={fetchMaintenances}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Maintenance</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this maintenance record? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Maintenance</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reset "{maintenanceToReset?.name}"? 
              The maintenance period will restart from the current value.
              {maintenanceToReset?.attributes?.periodUnit === "km" && " (Current odometer reading)"}
              {maintenanceToReset?.attributes?.periodUnit === "engineHours" && " (Current engine hours)"}
              {(maintenanceToReset?.attributes?.periodUnit === "days" || maintenanceToReset?.attributes?.periodUnit === "months" || maintenanceToReset?.attributes?.periodUnit === "hours") && " (Current time)"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetConfirm}
              disabled={resetting}
              className="bg-primary text-primary-foreground"
            >
              {resetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reset Maintenance
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
