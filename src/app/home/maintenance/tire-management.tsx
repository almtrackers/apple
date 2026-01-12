"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Wrench, AlertTriangle, CheckCircle2, RotateCw, Trash2, Clock, Circle, Calendar } from "lucide-react";
import { useWebSocket } from "@/contexts/websocket-context";
import apiClient from "@/lib/api";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

interface Maintenance {
  id: number;
  deviceId?: number;
  name: string;
  type: string;
  start: number;
  period: number;
  attributes?: {
    deviceId?: number;
    deviceName?: string;
    periodUnit?: string;
    tirePosition?: string;
    installationDate?: string;
    [key: string]: any;
  };
}

interface DeviceWithPosition {
  id: number;
  name: string;
  position?: {
    attributes?: {
      totalDistance?: number;
      [key: string]: any;
    };
  };
  attributes?: {
    totalDistance?: number;
    [key: string]: any;
  };
}

interface Device {
  id: number;
  name: string;
  attributes?: {
    [key: string]: any;
    vehicleType?: "4-wheeler" | "8-wheeler";
    TFL?: number;
    TFR?: number;
    TRL?: number;
    TRR?: number;
    TRL1?: number;
    TRL2?: number;
    TRR1?: number;
    TRR2?: number;
    TFL_date?: string;
    TFR_date?: string;
    TRL_date?: string;
    TRR_date?: string;
    TRL1_date?: string;
    TRL2_date?: string;
    TRR1_date?: string;
    TRR2_date?: string;
  };
  position?: {
    attributes?: {
      totalDistance?: number;
    };
  };
}

interface TireInfo {
  position: string;
  installOdometer: number;
  installDate: string | null;
  currentOdometer: number;
  mileage: number;
  status: "normal" | "warning" | "replace";
}

const TIRE_POSITIONS_4W = ["TFL", "TFR", "TRL", "TRR"];
const TIRE_POSITIONS_8W = ["TFL", "TFR", "TRL1", "TRL2", "TRR1", "TRR2"];

// Interactive Tire Selection Component - Shows all possible tire slots with click-to-select
interface InteractiveTireSelectionProps {
  selectedSlots: Set<string>;
  tireSequence: Map<string, number>;
  onSlotToggle: (slot: string) => void;
}

function InteractiveTireSelection({
  selectedSlots,
  tireSequence,
  onSlotToggle,
}: InteractiveTireSelectionProps) {
  // Define all possible tire slots (up to 22 tires: 2 front + 5 rear axles with 4 tires each)
  const allPossibleSlots = useMemo(() => {
    const slots: string[] = ["TFL", "TFR"]; // Front tires
    
    // Rear tires: up to 5 axles (20 tires total)
    // Axle 1: TRL, TRL1, TRR, TRR1
    // Axle 2: TRL2, TRL3, TRR2, TRR3
    // Axle 3: TRL4, TRL5, TRR4, TRR5
    // Axle 4: TRL6, TRL7, TRR6, TRR7
    // Axle 5: TRL8, TRL9, TRR8, TRR9
    for (let axle = 0; axle < 5; axle++) {
      if (axle === 0) {
        slots.push("TRL", "TRL1", "TRR", "TRR1");
      } else {
        const baseNum = axle * 2;
        slots.push(`TRL${baseNum}`, `TRL${baseNum + 1}`, `TRR${baseNum}`, `TRR${baseNum + 1}`);
      }
    }
    
    return slots;
  }, []);

  // Organize slots by axle
  const frontSlots = allPossibleSlots.filter(s => s.startsWith("TF"));
  const rearSlots = allPossibleSlots.filter(s => s.startsWith("TR"));

  // Group rear slots by axle
  const rearSlotsByAxle = useMemo(() => {
    const axles: string[][] = [];
    const slotMap = new Map<number, string[]>();
    
    rearSlots.forEach(slot => {
      const numMatch = slot.match(/\d+/);
      const num = numMatch ? parseInt(numMatch[0]) : 0;
      
      let axleNum: number;
      if (num === 0) {
        axleNum = 1; // TRL or TRR (outer tires on axle 1)
      } else if (num === 1) {
        axleNum = 1; // TRL1 or TRR1 (inner tires on axle 1)
      } else {
        // For num >= 2: axle = ceil((num + 1) / 2)
        axleNum = Math.ceil((num + 1) / 2);
      }
      
      if (!slotMap.has(axleNum)) {
        slotMap.set(axleNum, []);
      }
      slotMap.get(axleNum)!.push(slot);
    });
    
    const sortedAxles = Array.from(slotMap.keys()).sort((a, b) => a - b);
    sortedAxles.forEach(axleNum => {
      const slots = slotMap.get(axleNum)!;
      slots.sort((a, b) => {
        const isLeftA = a.includes("L");
        const isLeftB = b.includes("L");
        if (isLeftA && !isLeftB) return -1;
        if (!isLeftA && isLeftB) return 1;
        const numA = parseInt(a.match(/\d+/)?.[0] || "0");
        const numB = parseInt(b.match(/\d+/)?.[0] || "0");
        return numA - numB;
      });
      axles.push(slots);
    });
    
    return axles;
  }, [rearSlots]);

  // ViewBox dimensions
  const viewBoxWidth = 1000;
  const viewBoxHeight = 1800; // Enough for 5 rear axles
  const centerX = viewBoxWidth / 2;
  const gearboxWidth = 140;
  const gearboxHeight = 240;
  const diffRadius = 70;
  const axleStrokeWidth = 40;
  const frontAxleY = 190;
  const tireWidth = 180;
  const tireHeight = 260;
  const tireRadius = 60;
  const leftTireX = 160;
  const rightTireX = viewBoxWidth - 160 - tireWidth;
  const dualWheelSpacing = 100;

  // Calculate max axle number
  const maxAxleNum = rearSlotsByAxle.length;
  const lastAxleY = frontAxleY + 410 * maxAxleNum;
  const gearboxY = (frontAxleY + lastAxleY) / 2;
  const svgHeight = Math.max(1200, frontAxleY + (maxAxleNum) * 410 + 200);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="mb-4 text-center">
        <p className="text-sm text-muted-foreground">
          Click on tire positions to select them. Selected tires will be numbered sequentially (1, 2, 3...)
        </p>
        <p className="text-sm font-medium mt-1">
          Selected: {selectedSlots.size} tire{selectedSlots.size !== 1 ? "s" : ""}
        </p>
      </div>
      <div className="w-full h-96 border rounded-lg bg-muted/20 overflow-hidden">
        <svg
          viewBox={`0 0 ${viewBoxWidth} ${svgHeight}`}
          className="w-full h-full"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="6" stdDeviation="12" floodOpacity="0.18"/>
            </filter>
            {/* Modern gradient for gearbox */}
            <linearGradient id="gearboxGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="1" />
              <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0.8" />
            </linearGradient>
            {/* Modern gradient for differentials */}
            <radialGradient id="diffGradient" cx="50%" cy="50%">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="1" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.7" />
            </radialGradient>
            {/* Modern gradient for vehicle body */}
            <linearGradient id="vehicleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--muted))" stopOpacity="1" />
              <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.3" />
            </linearGradient>
            {/* Modern gradient for tires */}
            <radialGradient id="tireGradient" cx="50%" cy="50%">
              <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity="0.9" />
              <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity="0.6" />
            </radialGradient>
            {/* Selected tire gradient */}
            <radialGradient id="selectedTireGradient" cx="50%" cy="50%">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="1" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.7" />
            </radialGradient>
          </defs>

          {/* Axles */}
          <g stroke="hsl(var(--muted-foreground))" strokeWidth={axleStrokeWidth} strokeLinecap="round" fill="none" opacity="0.6">
            <line x1={leftTireX} y1={frontAxleY} x2={rightTireX + tireWidth} y2={frontAxleY} />
            {rearSlotsByAxle.map((_, idx) => {
              const axleY = frontAxleY + 410 * (idx + 1);
              return (
                <line 
                  key={`rear-axle-${idx}`}
                  x1={leftTireX} 
                  y1={axleY} 
                  x2={rightTireX + tireWidth} 
                  y2={axleY} 
                />
              );
            })}
            {rearSlotsByAxle.length > 0 && (
              <line 
                x1={centerX} 
                y1={frontAxleY + diffRadius} 
                x2={centerX} 
                y2={lastAxleY + diffRadius} 
              />
            )}
          </g>

          {/* Gearbox */}
          <rect
            filter="url(#shadow)"
            x={centerX - gearboxWidth / 2}
            y={gearboxY - gearboxHeight / 2}
            rx={40}
            ry={40}
            width={gearboxWidth}
            height={gearboxHeight}
            fill="url(#gearboxGradient)"
            stroke="hsl(var(--accent-foreground))"
            strokeWidth="2"
            opacity="0.9"
          />

          {/* Differentials */}
          <circle
            filter="url(#shadow)"
            cx={centerX}
            cy={frontAxleY}
            r={diffRadius}
            fill="url(#diffGradient)"
            stroke="hsl(var(--primary-foreground))"
            strokeWidth="2"
            opacity="0.9"
          />
          {rearSlotsByAxle.map((_, idx) => {
            const axleY = frontAxleY + 410 * (idx + 1);
            return (
              <circle
                key={`rear-diff-${idx}`}
                filter="url(#shadow)"
                cx={centerX}
                cy={axleY}
                r={diffRadius}
                fill="url(#diffGradient)"
                stroke="hsl(var(--primary-foreground))"
                strokeWidth="2"
                opacity="0.9"
              />
            );
          })}

          {/* Connection lines */}
          <g stroke="hsl(var(--muted-foreground))" strokeWidth={axleStrokeWidth} strokeLinecap="round" fill="none" opacity="0.6">
            <line x1={centerX} y1={frontAxleY + diffRadius} x2={centerX} y2={frontAxleY + diffRadius + 80} />
            {rearSlotsByAxle.map((_, idx) => {
              const axleY = frontAxleY + 410 * (idx + 1);
              return (
                <line
                  key={`rear-conn-${idx}`}
                  x1={centerX}
                  y1={axleY - diffRadius}
                  x2={centerX}
                  y2={axleY - diffRadius - 80}
                />
              );
            })}
          </g>

          {/* Front tire slots */}
          {frontSlots.map((slot) => {
            const isLeft = slot.includes("L");
            const isSelected = selectedSlots.has(slot);
            const sequenceNum = tireSequence.get(slot);
            
            return (
              <g key={slot}>
                <rect
                  filter="url(#shadow)"
                  x={isLeft ? leftTireX : rightTireX}
                  y={frontAxleY - tireHeight / 2}
                  rx={tireRadius}
                  ry={tireRadius}
                  width={tireWidth}
                  height={tireHeight}
                  fill={isSelected ? "url(#selectedTireGradient)" : "url(#tireGradient)"}
                  stroke={isSelected ? "hsl(var(--primary))" : "hsl(var(--border))"}
                  strokeWidth={isSelected ? "4" : "2"}
                  opacity={isSelected ? "1" : "0.5"}
                  style={{ cursor: "pointer" }}
                  onClick={() => onSlotToggle(slot)}
                  className="transition-all hover:opacity-80"
                />
                {sequenceNum && (
                  <text
                    x={isLeft ? leftTireX + tireWidth / 2 : rightTireX + tireWidth / 2}
                    y={frontAxleY}
                    textAnchor="middle"
                    fontSize="64"
                    fill="white"
                    fontWeight="900"
                    fontFamily="Arial, sans-serif"
                    style={{ 
                      pointerEvents: "none", 
                      userSelect: "none",
                      fontWeight: "900",
                      stroke: "rgba(0, 0, 0, 0.3)",
                      strokeWidth: "1"
                    }}
                  >
                    {sequenceNum}
                  </text>
                )}
              </g>
            );
          })}

          {/* Rear tire slots */}
          {rearSlotsByAxle.map((axleSlots, axleIdx) => {
            const axleY = frontAxleY + 410 * (axleIdx + 1);
            
            return axleSlots.map((slot) => {
              const isLeft = slot.includes("L");
              const numMatch = slot.match(/\d+/);
              const num = numMatch ? parseInt(numMatch[0]) : 0;
              const isInner = num > 0 && num % 2 === 1;
              const isSelected = selectedSlots.has(slot);
              const sequenceNum = tireSequence.get(slot);
              
              const width = isInner ? tireWidth - 40 : tireWidth;
              const height = isInner ? tireHeight - 40 : tireHeight;
              
              let x: number;
              if (isInner) {
                const outerCenter = (isLeft ? leftTireX : rightTireX) + tireWidth / 2;
                const direction = isLeft ? 1 : -1;
                const innerCenter = outerCenter + direction * dualWheelSpacing;
                x = innerCenter - width / 2;
              } else {
                x = isLeft ? leftTireX : rightTireX;
              }
              
              return (
                <g key={slot}>
                  <rect
                    filter="url(#shadow)"
                    x={x}
                    y={axleY - height / 2}
                    rx={tireRadius}
                    ry={tireRadius}
                    width={width}
                    height={height}
                    fill={isSelected ? "url(#selectedTireGradient)" : "url(#tireGradient)"}
                    stroke={isSelected ? "hsl(var(--primary))" : "hsl(var(--border))"}
                    strokeWidth={isSelected ? "4" : "2"}
                    opacity={isSelected ? "1" : "0.5"}
                    style={{ cursor: "pointer" }}
                    onClick={() => onSlotToggle(slot)}
                    className="transition-all hover:opacity-80"
                  />
                  {sequenceNum && (
                    <text
                      x={x + width / 2}
                      y={axleY}
                      textAnchor="middle"
                      fontSize={isInner ? "56" : "64"}
                      fill="white"
                      fontWeight="900"
                      fontFamily="Arial, sans-serif"
                      style={{ 
                        pointerEvents: "none", 
                        userSelect: "none",
                        fontWeight: "900",
                        stroke: "rgba(0, 0, 0, 0.3)",
                        strokeWidth: "1"
                      }}
                    >
                      {sequenceNum}
                    </text>
                  )}
                </g>
              );
            });
          })}
        </svg>
      </div>
    </div>
  );
}

// Bottom Vehicle Diagram Component - Clean drivetrain diagram matching the HTML example
interface BottomVehicleDiagramProps {
  vehicleType: "4-wheeler" | "8-wheeler";
  highlightedTire: string;
  tireStatus: string;
  getStatusColor: (status: string) => string;
  tirePositions?: string[]; // Optional: actual tire positions to render
  tireNumbers?: Map<string, number>; // Optional: tire number mapping (slot -> number)
}

function BottomVehicleDiagram({
  vehicleType,
  highlightedTire,
  tireStatus,
  getStatusColor,
  tirePositions: providedTirePositions,
  tireNumbers,
}: BottomVehicleDiagramProps) {
  // Get all tire positions - use provided or default based on vehicle type
  const allTirePositions = providedTirePositions || (vehicleType === "4-wheeler" 
    ? ["TFL", "TFR", "TRL", "TRR"]
    : ["TFL", "TFR", "TRL", "TRL1", "TRR", "TRR1"]);

  // Organize tires by axle position
  // Front tires: TFL, TFR
  // Rear tires: TRL, TRR, TRL1, TRR1, TRL2, TRR2, etc.
  const frontTires = allTirePositions.filter(p => p.startsWith("TF"));
  const rearTires = allTirePositions.filter(p => p.startsWith("TR"));
  
  // Group rear tires by axle
    // Pattern:
  //   Axle 1: TRL (outer), TRL1 (inner), TRR (outer), TRR1 (inner)
  //   Axle 2: TRL2 (outer), TRL3 (inner), TRR2 (outer), TRR3 (inner)
  //   Axle 3: TRL4 (outer), TRL5 (inner), TRR4 (outer), TRR5 (inner)
  //   etc.
  const rearAxles: string[][] = [];
  
  // Collect all rear tire positions and group by axle
  const rearPositionsByAxle = new Map<number, string[]>();
  
  rearTires.forEach(pos => {
    const numMatch = pos.match(/\d+/);
        const num = numMatch ? parseInt(numMatch[0]) : 0;
        
    // Determine axle number
    // num=0 or num=1: axle 1
    // num=2 or num=3: axle 2
    // num=4 or num=5: axle 3
          // Pattern: 
    //   - num=0: axle 1
    //   - num=1: axle 1 (inner tire on axle 1)
    //   - num=2: axle 2 (outer tire on axle 2)
    //   - num=3: axle 2 (inner tire on axle 2)
    //   - num=4: axle 3 (outer tire on axle 3)
    //   - num=5: axle 3 (inner tire on axle 3)
    // Formula: axle = Math.ceil((num + 1) / 2)
    let axleNum: number;
    if (num === 0) {
      axleNum = 1; // TRL or TRR (outer tires on axle 1)
    } else if (num === 1) {
      axleNum = 1; // TRL1 or TRR1 (inner tires on axle 1)
          } else {
      // For num >= 2: axle = ceil((num + 1) / 2)
      // num=2: ceil(3/2) = ceil(1.5) = 2
      // num=3: ceil(4/2) = ceil(2) = 2
      // num=4: ceil(5/2) = ceil(2.5) = 3
      // num=5: ceil(6/2) = ceil(3) = 3
      axleNum = Math.ceil((num + 1) / 2);
    }
    
    if (!rearPositionsByAxle.has(axleNum)) {
      rearPositionsByAxle.set(axleNum, []);
    }
    rearPositionsByAxle.get(axleNum)!.push(pos);
  });
  
  // Sort axles and convert to array
  const sortedAxleNumbers = Array.from(rearPositionsByAxle.keys()).sort((a, b) => a - b);
  sortedAxleNumbers.forEach(axleNum => {
    const positions = rearPositionsByAxle.get(axleNum)!;
    // Sort positions: L before R, outer before inner
    positions.sort((a, b) => {
      const isLeftA = a.includes("L");
      const isLeftB = b.includes("L");
      if (isLeftA && !isLeftB) return -1;
      if (!isLeftA && isLeftB) return 1;
      
      const numA = parseInt(a.match(/\d+/)?.[0] || "0");
      const numB = parseInt(b.match(/\d+/)?.[0] || "0");
      return numA - numB;
    });
    rearAxles.push(positions);
  });
  
  // Ensure all axles have tires on both sides if possible
  // If last axle only has single tires, ensure they're displayed correctly
  if (rearAxles.length > 0) {
    const lastAxle = rearAxles[rearAxles.length - 1];
    // Check if last axle has both left and right tires
    const hasLeftTires = lastAxle.some(p => p.includes("L"));
    const hasRightTires = lastAxle.some(p => p.includes("R"));
    
    // If we have tires on last axle, ensure they're all included
    // This handles cases where only single tires are on the last axle
    if (hasLeftTires || hasRightTires) {
      // All tires on last axle are already included, no need to add anything
    }
  }

  // Calculate positions based on viewBox scale
  const viewBoxWidth = 1000;
  const viewBoxHeight = 1200;
  const centerX = viewBoxWidth / 2;
  const gearboxWidth = 140;
  const gearboxHeight = 240;
  const diffRadius = 70;
  const axleStrokeWidth = 40;
  
  // Axle Y positions (scaled from example)
  const frontAxleY = 190;
  // Calculate the maximum axle number to determine the last axle position
  const maxAxleNum = rearPositionsByAxle.size > 0 ? Math.max(...Array.from(rearPositionsByAxle.keys())) : 0;
  const maxAxleIdx = maxAxleNum > 0 ? maxAxleNum - 1 : 0;
  const lastAxleY = maxAxleNum > 0 ? frontAxleY + 410 * (maxAxleIdx + 1) : frontAxleY + 410;
  const gearboxY = (frontAxleY + lastAxleY) / 2;
  
  // Tire dimensions
  const tireWidth = 180; // Width of single tire
  const tireHeight = 260; // Height of tire
  const tireRadius = 60;
  const leftTireX = 160;
  const rightTireX = viewBoxWidth - 160 - tireWidth;
  const dualWheelSpacing = 100; // Space between dual wheels on same side

  // Color map for tire status
  // Modern theme-aware color map with gradients
  const getTireColor = (statusColor: string): string => {
    switch (statusColor) {
      case "destructive":
        return "url(#tireReplaceGradient)"; // Red gradient for replace
      case "default":
        return "url(#tireWarningGradient)"; // Yellow/amber gradient for warning
      case "secondary":
        return "url(#tireNormalGradient)"; // Green gradient for normal
      default:
        return "url(#tireGradientBottom)"; // Default theme gradient
    }
  };

  const statusColor = getStatusColor(tireStatus);
  const tireColor = getTireColor(statusColor);

  // Calculate viewBox based on number of axles
  const numAxles = 1 + maxAxleNum;
  const calculatedHeight = frontAxleY + (numAxles - 1) * 410 + 200;
  const svgHeight = Math.max(viewBoxHeight, calculatedHeight);

  // Dynamic container size based on number of axles - smaller on small screens
  const getContainerSize = () => {
    const tireCount = allTirePositions.length;
    if (tireCount <= 4) {
      return {
        width: "w-[80px] min-[640px]:w-[100px] min-[641px]:w-32",
        height: "h-[96px] min-[640px]:h-[120px] min-[641px]:h-40",
        maxWidth: "max-w-[80px] min-[640px]:max-w-[100px] min-[641px]:max-w-[128px]"
      };
    } else if (tireCount <= 6) {
      return {
        width: "w-[88px] min-[640px]:w-[110px] min-[641px]:w-36",
        height: "h-[106px] min-[640px]:h-[132px] min-[641px]:h-44",
        maxWidth: "max-w-[88px] min-[640px]:max-w-[110px] min-[641px]:max-w-[144px]"
      };
    } else if (tireCount <= 10) {
      return {
        width: "w-[96px] min-[640px]:w-[120px] min-[641px]:w-40",
        height: "h-[115px] min-[640px]:h-[144px] min-[641px]:h-48",
        maxWidth: "max-w-[96px] min-[640px]:max-w-[120px] min-[641px]:max-w-[160px]"
      };
    } else if (tireCount <= 14) {
      return {
        width: "w-[104px] min-[640px]:w-[130px] min-[641px]:w-44",
        height: "h-[125px] min-[640px]:h-[156px] min-[641px]:h-52",
        maxWidth: "max-w-[104px] min-[640px]:max-w-[130px] min-[641px]:max-w-[176px]"
      };
    } else if (tireCount <= 18) {
      return {
        width: "w-[112px] min-[640px]:w-[140px] min-[641px]:w-48",
        height: "h-[134px] min-[640px]:h-[168px] min-[641px]:h-56",
        maxWidth: "max-w-[112px] min-[640px]:max-w-[140px] min-[641px]:max-w-[192px]"
      };
    } else {
      return {
        width: "w-[120px] min-[640px]:w-[150px] min-[641px]:w-52",
        height: "h-[144px] min-[640px]:h-[180px] min-[641px]:h-60",
        maxWidth: "max-w-[120px] min-[640px]:max-w-[150px] min-[641px]:max-w-[208px]"
      };
    }
  };
  
  const containerSize = getContainerSize();
  
  return (
    <div 
      className={`${containerSize.width} ${containerSize.height} ${containerSize.maxWidth} flex items-center justify-center`} 
      style={{ 
        transform: 'translateZ(0)', 
        minWidth: 0, 
        minHeight: 0, 
        width: '100%', 
        height: '100%',
        position: 'relative',
        overflow: 'visible',
        maxWidth: '100%',
        maxHeight: '100%',
        marginBottom: '-8px'
      }}
    >
      <svg
        viewBox={`0 0 ${viewBoxWidth} ${svgHeight}`}
        className="w-full h-auto max-w-full max-h-full"
        preserveAspectRatio="xMidYMid meet"
        style={{
          display: 'block',
          width: '100%',
          height: 'auto',
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: 'contain',
          transform: 'translateZ(0)',
          backfaceVisibility: 'visible',
          WebkitBackfaceVisibility: 'visible'
        }}
      >
        <defs>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="6" stdDeviation="12" floodOpacity="0.18"/>
          </filter>
          {/* Modern gradient for gearbox */}
          <linearGradient id="gearboxGradientBottom" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="1" />
            <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0.8" />
          </linearGradient>
          {/* Modern gradient for differentials */}
          <radialGradient id="diffGradientBottom" cx="50%" cy="50%">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="1" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.7" />
          </radialGradient>
          {/* Modern gradient for vehicle body */}
          <linearGradient id="vehicleGradientBottom" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--muted))" stopOpacity="1" />
            <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.3" />
          </linearGradient>
          {/* Modern gradient for tires */}
          <radialGradient id="tireGradientBottom" cx="50%" cy="50%">
            <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity="0.9" />
            <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity="0.6" />
          </radialGradient>
          {/* Status color gradients for modern look */}
          <radialGradient id="tireNormalGradient" cx="50%" cy="50%">
            <stop offset="0%" stopColor="hsl(var(--chart-2))" stopOpacity="1" />
            <stop offset="100%" stopColor="hsl(var(--chart-2))" stopOpacity="0.7" />
          </radialGradient>
          <radialGradient id="tireWarningGradient" cx="50%" cy="50%">
            <stop offset="0%" stopColor="hsl(var(--chart-4))" stopOpacity="1" />
            <stop offset="100%" stopColor="hsl(var(--chart-4))" stopOpacity="0.7" />
          </radialGradient>
          <radialGradient id="tireReplaceGradient" cx="50%" cy="50%">
            <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity="1" />
            <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity="0.7" />
          </radialGradient>
        </defs>

        {/* Axles - horizontal lines connecting wheels */}
        <g stroke="hsl(var(--muted-foreground))" strokeWidth={axleStrokeWidth} strokeLinecap="round" fill="none" opacity="0.6">
          {/* Front axle */}
          <line x1={leftTireX + tireWidth / 2} y1={frontAxleY} x2={rightTireX + tireWidth / 2} y2={frontAxleY} />
          
          {/* Rear axles - create axles for all rear tire positions */}
          {Array.from(rearPositionsByAxle.keys()).sort((a, b) => a - b).map((axleNum) => {
            const axleIdx = axleNum - 1;
            const axleY = frontAxleY + 410 * (axleIdx + 1);
            return (
              <line 
                key={`rear-axle-${axleNum}`}
                x1={leftTireX + tireWidth / 2} 
                y1={axleY} 
                x2={rightTireX + tireWidth / 2} 
                y2={axleY} 
              />
            );
          })}
          
          {/* Central driveshaft - vertical line */}
          {rearPositionsByAxle.size > 0 && (() => {
            const maxAxleNum = Math.max(...Array.from(rearPositionsByAxle.keys()));
            const maxAxleIdx = maxAxleNum - 1;
            const maxAxleY = frontAxleY + 410 * (maxAxleIdx + 1);
            return (
          <line
            x1={centerX}
                y1={frontAxleY + diffRadius} 
            x2={centerX}
                y2={maxAxleY + diffRadius} 
              />
            );
          })()}
        </g>

        {/* Gearbox - modern theme-colored rectangle in center */}
        <rect
          filter="url(#shadow)"
          x={centerX - gearboxWidth / 2}
          y={gearboxY - gearboxHeight / 2}
          rx={40}
          ry={40}
          width={gearboxWidth}
          height={gearboxHeight}
          fill="url(#gearboxGradientBottom)"
          stroke="hsl(var(--accent-foreground))"
          strokeWidth="2"
          opacity="0.9"
        />

        {/* Differentials - modern theme-colored circles at each axle */}
        <g>
          {/* Front differential */}
          <circle
            filter="url(#shadow)"
            cx={centerX}
            cy={frontAxleY}
            r={diffRadius}
            fill="url(#diffGradientBottom)"
            stroke="hsl(var(--primary-foreground))"
            strokeWidth="2"
            opacity="0.9"
          />
          
          {/* Rear differentials - create for all axles with tires */}
          {Array.from(rearPositionsByAxle.keys()).sort((a, b) => a - b).map((axleNum) => {
            const axleIdx = axleNum - 1;
            const axleY = frontAxleY + 410 * (axleIdx + 1);
          return (
              <circle
                key={`rear-diff-${axleNum}`}
                filter="url(#shadow)"
                cx={centerX}
                cy={axleY}
                r={diffRadius}
                fill="url(#diffGradientBottom)"
                stroke="hsl(var(--primary-foreground))"
                strokeWidth="2"
                opacity="0.9"
              />
            );
          })}
        </g>

        {/* Connection lines from driveshaft to differentials */}
        <g stroke="hsl(var(--muted-foreground))" strokeWidth={axleStrokeWidth} strokeLinecap="round" fill="none" opacity="0.6">
          {/* Front connection - from differential down */}
          <line x1={centerX} y1={frontAxleY + diffRadius + 70} x2={centerX} y2={frontAxleY + diffRadius + 150} />
          
          {/* Rear connections - from differential up */}
          {Array.from(rearPositionsByAxle.keys()).sort((a, b) => a - b).map((axleNum) => {
            const axleIdx = axleNum - 1;
            const axleY = frontAxleY + 410 * (axleIdx + 1);
            // Connection line from differential up (similar to reference: 670->530, 940->1080)
            const topY = axleY - diffRadius - 70;
            const bottomY = axleY - diffRadius - 150;
            return (
              <line
                key={`rear-conn-${axleNum}`}
                x1={centerX}
                y1={topY}
                x2={centerX}
                y2={bottomY}
              />
            );
          })}
        </g>

        {/* Wheels/Tires - modern theme-colored rounded rectangles */}
        <g>
          {/* Front wheels - single on each side */}
          {frontTires.map((position) => {
            const isLeft = position.includes("L");
          const normalizedPosition = position.trim().toUpperCase();
          const normalizedHighlighted = (highlightedTire || "").trim().toUpperCase();
          const isHighlighted = normalizedPosition === normalizedHighlighted && normalizedHighlighted !== "";
            const tireNumber = tireNumbers?.get(position);
          
          return (
            <g key={position}>
                  <rect
                  filter="url(#shadow)"
                  x={isLeft ? leftTireX : rightTireX}
                  y={frontAxleY - tireHeight / 2}
                  rx={tireRadius}
                  ry={tireRadius}
                  width={tireWidth}
                  height={tireHeight}
                  fill={isHighlighted ? tireColor : "url(#tireGradientBottom)"}
                  stroke={isHighlighted ? "hsl(var(--primary))" : "hsl(var(--border))"}
                  strokeWidth={isHighlighted ? "4" : "2"}
                  opacity={isHighlighted ? "1" : "0.7"}
                style={{
                  transition: "all 0.3s ease",
                }}
              />
                {tireNumber && (
              <text
                    x={isLeft ? leftTireX + tireWidth / 2 : rightTireX + tireWidth / 2}
                    y={frontAxleY}
                textAnchor="middle"
                    fontSize="64"
                    fill="white"
                    fontWeight="900"
                    fontFamily="Arial, sans-serif"
                style={{
                  pointerEvents: "none",
                  userSelect: "none",
                      fontWeight: "900",
                      stroke: "rgba(0, 0, 0, 0.3)",
                      strokeWidth: "1"
                }}
              >
                    {tireNumber}
              </text>
                )}
            </g>
          );
        })}
        
          {/* Rear wheels - render all rear tires, grouped by axle */}
          {rearTires.map((position) => {
            const isLeft = position.includes("L");
            const numMatch = position.match(/\d+/);
            const num = numMatch ? parseInt(numMatch[0]) : 0;
            
            // Determine which axle this tire belongs to (same logic as grouping)
            let axleNum: number;
            if (num === 0) {
              axleNum = 1; // TRL or TRR (outer tires on axle 1)
            } else if (num === 1) {
              axleNum = 1; // TRL1 or TRR1 (inner tires on axle 1)
            } else {
              // For num >= 2: axle = ceil((num + 1) / 2)
              axleNum = Math.ceil((num + 1) / 2);
            }
            
            // Find the axle index in rearAxles array
            const axleIdx = axleNum - 1;
            const axleY = frontAxleY + 410 * (axleIdx + 1);
            
            const isInner = num > 0 && num % 2 === 1; // TRL1, TRR1, TRL3, etc. are inner
            
            const normalizedPosition = position.trim().toUpperCase();
            const normalizedHighlighted = (highlightedTire || "").trim().toUpperCase();
            const isHighlighted = normalizedPosition === normalizedHighlighted && normalizedHighlighted !== "";
            const tireNumber = tireNumbers?.get(position);
            
            // Calculate X position - inner wheels are closer to center
            // Inner wheels are slightly smaller
            const width = isInner ? tireWidth - 40 : tireWidth;
            const height = isInner ? tireHeight - 40 : tireHeight;
            
            let x: number;
            if (isInner) {
              const outerCenter = (isLeft ? leftTireX : rightTireX) + tireWidth / 2;
              const direction = isLeft ? 1 : -1;
              const innerCenter = outerCenter + direction * dualWheelSpacing;
              x = innerCenter - width / 2;
            } else {
              x = isLeft ? leftTireX : rightTireX;
            }
            
            return (
              <g key={position}>
                <rect
                  filter="url(#shadow)"
                  x={x}
                  y={axleY - height / 2}
                  rx={tireRadius}
                  ry={tireRadius}
                  width={width}
                  height={height}
                  fill={isHighlighted ? tireColor : "url(#tireGradientBottom)"}
                  stroke={isHighlighted ? "hsl(var(--primary))" : "hsl(var(--border))"}
                  strokeWidth={isHighlighted ? "4" : "2"}
                  opacity={isHighlighted ? "1" : (isInner ? "0.6" : "0.7")}
                  style={{
                    transition: "all 0.3s ease",
                  }}
                />
                {tireNumber && (
          <text
                    x={x + width / 2}
                    y={axleY}
            textAnchor="middle"
                    fontSize={isInner ? "56" : "64"}
                    fill="white"
                    fontWeight="900"
                    fontFamily="Arial, sans-serif"
                    style={{ 
                      pointerEvents: "none", 
                      userSelect: "none",
                      fontWeight: "900",
                      stroke: "rgba(0, 0, 0, 0.3)",
                      strokeWidth: "1"
                    }}
                  >
                    {tireNumber}
          </text>
        )}
              </g>
            );
          })}
        </g>

        {/* Highlighted tire glow effect */}
        {allTirePositions.map((position) => {
          const normalizedPosition = position.trim().toUpperCase();
          const normalizedHighlighted = (highlightedTire || "").trim().toUpperCase();
          const isHighlighted = normalizedPosition === normalizedHighlighted && normalizedHighlighted !== "";
          
          if (!isHighlighted) return null;
          
          const isFront = position.startsWith("TF");
          const isLeft = position.includes("L");
          const numMatch = position.match(/\d+/);
          const num = numMatch ? parseInt(numMatch[0]) : 0;
          const isInner = num > 0 && num % 2 === 1;
          
          let x: number;
          let y: number;
          let width: number;
          let height: number;
          
          if (isFront) {
            x = isLeft ? leftTireX : rightTireX;
            y = frontAxleY - tireHeight / 2;
            width = tireWidth;
            height = tireHeight;
          } else {
            // Find which rear axle this tire belongs to (same logic as grouping)
            let axleNum: number;
            if (num === 0) {
              axleNum = 1; // TRL or TRR (outer tires on axle 1)
            } else if (num === 1) {
              axleNum = 1; // TRL1 or TRR1 (inner tires on axle 1)
            } else {
              // For num >= 2: axle = ceil((num + 1) / 2)
              axleNum = Math.ceil((num + 1) / 2);
            }
            
            // Find the axle index in rearAxles array
            const axleIdx = axleNum - 1;
            const axleY = frontAxleY + 410 * (axleIdx + 1);
            
            width = isInner ? tireWidth - 40 : tireWidth;
            height = isInner ? tireHeight - 40 : tireHeight;
            if (isInner) {
              const outerCenter = (isLeft ? leftTireX : rightTireX) + tireWidth / 2;
              const direction = isLeft ? 1 : -1;
              const innerCenter = outerCenter + direction * dualWheelSpacing;
              x = innerCenter - width / 2;
            } else {
              x = isLeft ? leftTireX : rightTireX;
            }
            y = axleY - height / 2;
          }
          
          return (
            <rect
              key={`glow-${position}`}
              x={x - 8}
              y={y - 8}
              width={width + 16}
              height={height + 16}
              rx={tireRadius + 8}
              ry={tireRadius + 8}
          fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="3"
              opacity="0.4"
              className="animate-pulse"
        />
          );
        })}
      </svg>
    </div>
  );
}

// Mini Vehicle Diagram Component - Now uses BottomVehicleDiagram for consistency
// This component is kept for backward compatibility but redirects to BottomVehicleDiagram
interface MiniVehicleDiagramProps {
  vehicleType: "4-wheeler" | "8-wheeler";
  highlightedTire: string;
  tireStatus: string;
  getStatusColor: (status: string) => string;
  tirePositions?: string[];
}

function MiniVehicleDiagram({
  vehicleType,
  highlightedTire,
  tireStatus,
  getStatusColor,
  tirePositions,
}: MiniVehicleDiagramProps) {
  // Use BottomVehicleDiagram for consistency
  return (
    <BottomVehicleDiagram
      vehicleType={vehicleType}
      highlightedTire={highlightedTire}
      tireStatus={tireStatus}
      getStatusColor={getStatusColor}
      tirePositions={tirePositions}
    />
  );
}

export default function TireManagement() {
  const { devices: devicesMap } = useWebSocket();
  const { toast } = useToast();
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null);
  const [isInstallDialogOpen, setIsInstallDialogOpen] = useState(false);
  const [isReplaceDialogOpen, setIsReplaceDialogOpen] = useState(false);
  const [isTireSelectionDialogOpen, setIsTireSelectionDialogOpen] = useState(false);
  const [selectedTireSlots, setSelectedTireSlots] = useState<Set<string>>(new Set());
  const [tireSequence, setTireSequence] = useState<Map<string, number>>(new Map()); // Maps slot to sequence number
  const [selectedTirePosition, setSelectedTirePosition] = useState<string>("");
  const [highlightedTire, setHighlightedTire] = useState<string | null>(null);
  const [installOdometer, setInstallOdometer] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  
  // Dashboard states
  const [tireMaintenances, setTireMaintenances] = useState<Maintenance[]>([]);
  const [dashboardDevices, setDashboardDevices] = useState<DeviceWithPosition[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [maintenanceToReset, setMaintenanceToReset] = useState<Maintenance | null>(null);
  const [maintenanceToDelete, setMaintenanceToDelete] = useState<number | null>(null);
  const [resetting, setResetting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedVehicleFilter, setSelectedVehicleFilter] = useState<string>("all"); // "all" or deviceId
  const [replaceAllDialogOpen, setReplaceAllDialogOpen] = useState(false);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [replacingAll, setReplacingAll] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  const devices = Object.values(devicesMap);

  const selectedDevice = useMemo(
    () => devices.find((d) => d.id === selectedDeviceId) || null,
    [devices, selectedDeviceId]
  );

  // Tire positions are now determined by user selection via interactive diagram
  // No need for automatic generation based on count

  const currentOdometer = useMemo(() => {
    return (
      selectedDevice?.position?.attributes?.totalDistance ||
      selectedDevice?.attributes?.totalDistance ||
      0
    );
  }, [selectedDevice]);

  const tireData = useMemo(() => {
    if (!selectedDevice) return [];

    // Get tire data from device attributes (numbered tires or legacy slot-based)
    const tireDataList: TireInfo[] = [];
    
    // Check for numbered tires first (T1, T2, etc.)
    for (let i = 1; i <= 22; i++) {
      const tireKey = `T${i}`;
      const slot = selectedDevice.attributes?.[`${tireKey}_slot`] as string | undefined;
      if (slot && (selectedDevice.attributes?.[tireKey] !== undefined || selectedDevice.attributes?.[`${tireKey}_date`] !== undefined)) {
        const installOdometer = (selectedDevice.attributes?.[tireKey] as number) || currentOdometer;
        const installDate = selectedDevice.attributes?.[`${tireKey}_date`] as string | null;
        const mileage = currentOdometer - (installOdometer / 1000);

      let status: "normal" | "warning" | "replace" = "normal";
      if (mileage > 50000) status = "replace";
      else if (mileage > 30000) status = "warning";

        tireDataList.push({
          position: slot,
          installOdometer: installOdometer / 1000,
          installDate,
          currentOdometer,
          mileage,
          status,
        } as TireInfo);
      }
    }
    
    // If no numbered tires found, check legacy slot-based tires
    if (tireDataList.length === 0) {
      const tireKeys = ["TFL", "TFR", "TRL", "TRR", "TRL1", "TRL2", "TRR1", "TRR2"];
      tireKeys.forEach((position) => {
        if (selectedDevice.attributes?.[position] !== undefined || selectedDevice.attributes?.[`${position}_date`] !== undefined) {
          const installOdometer = (selectedDevice.attributes?.[position] as number) || currentOdometer;
          const installDate = selectedDevice.attributes?.[`${position}_date`] as string | null;
          const mileage = currentOdometer - (installOdometer / 1000);
          
          let status: "normal" | "warning" | "replace" = "normal";
          if (mileage > 50000) status = "replace";
          else if (mileage > 30000) status = "warning";
          
          tireDataList.push({
        position,
            installOdometer: installOdometer / 1000,
        installDate,
        currentOdometer,
        mileage,
        status,
          } as TireInfo);
        }
    });
    }
    
    return tireDataList;
  }, [selectedDevice, currentOdometer]);

  useEffect(() => {
    if (selectedDevice && currentOdometer > 0 && installOdometer === 0) {
      setInstallOdometer(Math.round(currentOdometer / 1000));
    }
  }, [selectedDevice, currentOdometer]);

  const handleInstallTires = async () => {
    if (!selectedDeviceId || !selectedDevice) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a vehicle first.",
      });
      return;
    }

    // Validate install odometer
    if (!installOdometer || installOdometer <= 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a valid odometer reading (must be greater than 0).",
      });
      return;
    }

    if (selectedTireSlots.size === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select at least one tire position.",
      });
      return;
    }

    setLoading(true);
    try {
      const updates: { [key: string]: number | string } = {};
      const installationDate = new Date().toISOString();
      const currentOdometerKm = Math.max(0, Math.round(installOdometer)); // Ensure positive integer
      const currentOdometerMeters = currentOdometerKm * 1000; // Convert to meters for device attributes
      
      // Store tires using numbered positions (1, 2, 3, etc.) instead of TFL, TFR, etc.
      // Store both the slot (physical position) and the sequence number
      const sortedSlots = Array.from(selectedTireSlots).sort((a, b) => {
        const numA = tireSequence.get(a) || 0;
        const numB = tireSequence.get(b) || 0;
        return numA - numB;
      });
      
      sortedSlots.forEach((slot) => {
        const tireNumber = tireSequence.get(slot) || 0;
        // Store as T1, T2, T3, etc. (numbered positions)
        const tireKey = `T${tireNumber}`;
        updates[tireKey] = currentOdometerMeters;
        updates[`${tireKey}_date`] = installationDate;
        // Also store the slot mapping for reference
        updates[`${tireKey}_slot`] = slot;
      });
      
      // Store the total tire count and slot-to-number mapping
      updates['tireCount'] = selectedTireSlots.size;
      updates['tireSlots'] = JSON.stringify(Array.from(selectedTireSlots));
      updates['tireSequence'] = JSON.stringify(Array.from(tireSequence.entries()));

      // Update device attributes - exclude read-only fields like 'position'
      try {
        const { position, lastUpdate, positionId, expirationTime, ...deviceUpdate } = selectedDevice;
        await apiClient.put(`/devices/${selectedDeviceId}`, {
          ...deviceUpdate,
          attributes: {
            ...selectedDevice.attributes,
            ...updates,
          },
        });
      } catch (deviceError: any) {
        const errorMessage = deviceError.response?.data?.message || deviceError.response?.data?.error || deviceError.message || "Failed to update device";
        console.error("Failed to update device attributes:", {
          error: errorMessage,
          details: deviceError.response?.data,
          status: deviceError.response?.status,
          deviceId: selectedDeviceId,
          updates,
        });
        throw new Error(`Failed to update device: ${errorMessage}`);
      }

      // Create maintenance records for each tire using numbered positions
      const maintenancePromises = sortedSlots.map(async (slot) => {
        const tireNumber = tireSequence.get(slot) || 0;
        const tirePosition = `T${tireNumber}`; // Use numbered position (T1, T2, T3, etc.)
        const maintenanceName = `${selectedDevice.name} - Tire Replacement - Tire ${tireNumber}`;
        const payload = {
          id: selectedDeviceId,
          name: maintenanceName,
          type: "Tire Replacement",
          start: currentOdometerKm, // Current odometer in km
          period: 50000, // 50,000 km default period for tire replacement
          attributes: {
            deviceId: selectedDeviceId,
            deviceName: selectedDevice.name,
            periodUnit: "km",
            startTimestamp: installationDate,
            tirePosition: tirePosition, // T1, T2, T3, etc.
            tireSlot: slot, // Physical slot (TFL, TFR, TRL, etc.) for reference
            tireNumber: tireNumber, // Sequence number
            installationDate: installationDate,
          },
        };

        try {
          // Create maintenance record
          const response = await apiClient.post("/maintenance", payload);
          const createdMaintenance = response.data;

          // Link maintenance to device via permissions
          if (createdMaintenance && createdMaintenance.id) {
            try {
              await apiClient.post("/permissions", {
                deviceId: selectedDeviceId,
                maintenanceId: createdMaintenance.id,
              });
            } catch (permissionError: any) {
              console.warn(`Failed to link maintenance for tire ${tirePosition}:`, permissionError);
            }
          }

          return { success: true, tirePosition, tireNumber };
        } catch (error: any) {
          console.error(`Failed to create maintenance for tire ${tirePosition}:`, error);
          return { success: false, tirePosition, tireNumber, error };
        }
      });

      const results = await Promise.all(maintenancePromises);
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      if (failureCount === 0) {
        toast({
          title: "Success",
          description: `${successCount} tire${successCount !== 1 ? "s" : ""} installed and ${successCount} maintenance record${successCount !== 1 ? "s" : ""} created for ${selectedDevice.name} at ${currentOdometerKm} km`,
        });
      } else {
        toast({
          variant: "default",
          title: "Partial Success",
          description: `Tires installed. ${successCount} maintenance records created, ${failureCount} failed.`,
        });
      }

      setIsInstallDialogOpen(false);
      setIsTireSelectionDialogOpen(false);
      setSelectedTireSlots(new Set());
      setTireSequence(new Map());
      setInstallOdometer(0);
      // Refresh tire dashboard after installation
      fetchTireMaintenances();
    } catch (error: any) {
      console.error("Failed to install tires:", error);
      const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || "Failed to install tires";
      const errorDetails = error.response?.data;
      
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
      
      // Log detailed error for debugging
      if (errorDetails) {
        console.error("Error details:", errorDetails);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReplaceTire = async () => {
    if (!selectedDeviceId || !selectedDevice || !selectedTirePosition) {
      return;
    }

    setLoading(true);
    try {
      const installationDate = new Date().toISOString();
      const currentOdometerKm = Math.round(currentOdometer / 1000);
      
      // Update device attributes - exclude read-only fields like 'position'
      const { position, lastUpdate, positionId, expirationTime, ...deviceUpdate } = selectedDevice;
      await apiClient.put(`/devices/${selectedDeviceId}`, {
        ...deviceUpdate,
        attributes: {
          ...selectedDevice.attributes,
          [selectedTirePosition]: currentOdometer,
          [`${selectedTirePosition}_date`]: installationDate,
        },
      });

      // Create or update maintenance record for this tire
      const maintenanceName = `${selectedDevice.name} - Tire Replacement - ${selectedTirePosition}`;
      const payload = {
        id: selectedDeviceId,
        name: maintenanceName,
        type: "Tire Replacement",
        start: currentOdometerKm,
        period: 50000, // 50,000 km default period
        attributes: {
          deviceId: selectedDeviceId,
          deviceName: selectedDevice.name,
          periodUnit: "km",
          startTimestamp: installationDate,
          tirePosition: selectedTirePosition,
          installationDate: installationDate,
        },
      };

      try {
        // Try to create maintenance record
        const response = await apiClient.post("/maintenance", payload);
        const createdMaintenance = response.data;

        // Link maintenance to device via permissions
        if (createdMaintenance && createdMaintenance.id) {
          try {
            await apiClient.post("/permissions", {
              deviceId: selectedDeviceId,
              maintenanceId: createdMaintenance.id,
            });
          } catch (permissionError: any) {
            console.warn(`Failed to link maintenance for tire ${selectedTirePosition}:`, permissionError);
          }
        }

        toast({
          title: "Success",
          description: `${selectedTirePosition} tire replaced at ${currentOdometerKm} km and maintenance record created`,
        });
      } catch (maintenanceError: any) {
        // If maintenance creation fails, still show success for tire replacement
        console.error("Failed to create maintenance record:", maintenanceError);
        toast({
          variant: "default",
          title: "Tire Replaced",
          description: `${selectedTirePosition} tire replaced at ${currentOdometerKm} km, but maintenance record creation failed`,
        });
      }

      setIsReplaceDialogOpen(false);
      setSelectedTirePosition("");
      // Refresh tire dashboard after replacement
      fetchTireMaintenances();
    } catch (error: any) {
      console.error("Failed to replace tire:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.message || "Failed to replace tire.",
      });
    } finally {
      setLoading(false);
    }
  };

  const getTireStatusColor = (status: string) => {
    switch (status) {
      case "replace":
        return "destructive";
      case "warning":
        return "default";
      default:
        return "secondary";
    }
  };

  const getTireStatusIcon = (status: string) => {
    switch (status) {
      case "replace":
        return <AlertTriangle className="h-4 w-4" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <CheckCircle2 className="h-4 w-4" />;
    }
  };

  // Fetch tire maintenance records for dashboard
  const fetchTireMaintenances = async () => {
    try {
      setDashboardLoading(true);
      
      // Fetch all maintenance records and devices
      const [maintenancesRes, devicesRes] = await Promise.all([
        apiClient.get<Maintenance[]>("/maintenance").catch((err: any) => {
          if (err.response?.status === 404) {
            return apiClient.get<Maintenance[]>("/maintenances");
          }
          throw err;
        }),
        apiClient.get<DeviceWithPosition[]>("/devices"),
      ]);

      const allMaintenances = maintenancesRes.data || [];
      const allDevices = devicesRes.data || [];

      // Filter only Tire Replacement maintenance records
      const tireMaint = allMaintenances.filter(
        (m) => m.type === "Tire Replacement"
      );

      // Fetch positions for devices
      const uniqueDeviceIds = [...new Set(
        tireMaint
          .map(m => m.deviceId || m.attributes?.deviceId || m.id)
          .filter((id): id is number => id !== undefined && id !== null)
      )];

      if (uniqueDeviceIds.length > 0) {
        try {
          const positionsPromises = uniqueDeviceIds.map(deviceId =>
            apiClient.get(`/positions?deviceId=${deviceId}`).catch(() => ({ data: [] }))
          );
          const positionsResults = await Promise.all(positionsPromises);
          const positionsMap = new Map<number, any>();
          positionsResults.forEach((result, index) => {
            const positions = result.data || [];
            if (positions.length > 0) {
              positionsMap.set(uniqueDeviceIds[index], positions[0]);
            }
          });

          const devicesWithPositions = allDevices.map(device => ({
            ...device,
            position: positionsMap.get(device.id),
          }));

          setDashboardDevices(devicesWithPositions);
        } catch (positionsError) {
          console.error("Failed to fetch positions:", positionsError);
          setDashboardDevices(allDevices);
        }
      } else {
        setDashboardDevices(allDevices);
      }

      setTireMaintenances(tireMaint);
    } catch (error) {
      console.error("Failed to fetch tire maintenances:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load tire maintenance records.",
      });
    } finally {
      setDashboardLoading(false);
    }
  };

  useEffect(() => {
    fetchTireMaintenances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helper function to calculate tire positions from device attributes
  // Now handles both numbered tires (T1, T2, etc.) and slot-based tires (TFL, TFR, etc.)
  const getTirePositionsFromDevice = useCallback((device: DeviceWithPosition | undefined): string[] => {
    if (!device) return TIRE_POSITIONS_4W; // Default to 4-wheeler
    
    // Check for numbered tires first (T1, T2, T3, etc.)
    const numberedTireKeys: string[] = [];
    for (let i = 1; i <= 22; i++) {
      const tireKey = `T${i}`;
      if (device.attributes?.[tireKey] !== undefined || device.attributes?.[`${tireKey}_date`] !== undefined) {
        numberedTireKeys.push(tireKey);
      }
    }
    
    // If we found numbered tires, get their slot mappings
    if (numberedTireKeys.length > 0) {
      const slots: string[] = [];
      numberedTireKeys.forEach(tireKey => {
        const slot = device.attributes?.[`${tireKey}_slot`] as string;
        if (slot) {
          slots.push(slot);
        }
      });
      if (slots.length > 0) {
        return slots.sort((a, b) => {
          if (a.startsWith("TF") && !b.startsWith("TF")) return -1;
          if (!a.startsWith("TF") && b.startsWith("TF")) return 1;
          if (a.includes("L") && b.includes("R")) return -1;
          if (a.includes("R") && b.includes("L")) return 1;
          const numA = parseInt(a.match(/\d+/)?.[0] || "0");
          const numB = parseInt(b.match(/\d+/)?.[0] || "0");
          return numA - numB;
        });
      }
    }
    
    // Check device attributes for tire position keys (legacy slot-based)
    const tireKeys = [
      "TFL", "TFR", "TRL", "TRR", 
      "TRL1", "TRL2", "TRR1", "TRR2",
      "TRL3", "TRL4", "TRR3", "TRR4",
      "TRL5", "TRL6", "TRR5", "TRR6",
      "TRL7", "TRL8", "TRR7", "TRR8",
      "TRL9", "TRL10", "TRR9", "TRR10",
    ];
    
    // Find all tire positions that exist in device attributes
    const existingPositions = tireKeys.filter(key => 
      device.attributes?.[key] !== undefined || 
      device.attributes?.[`${key}_date`] !== undefined
    );
    
    // If we found tire positions, use them
    if (existingPositions.length > 0) {
      // Sort positions to ensure correct order: TFL, TFR, then rear positions in order
      const sortedPositions = existingPositions.sort((a, b) => {
        // Front tires first
        if (a.startsWith("TF") && !b.startsWith("TF")) return -1;
        if (!a.startsWith("TF") && b.startsWith("TF")) return 1;
        
        // Then by side (L before R)
        if (a.includes("L") && b.includes("R")) return -1;
        if (a.includes("R") && b.includes("L")) return 1;
        
        // Then by number (extract number or treat as 0)
        const numA = parseInt(a.match(/\d+/)?.[0] || "0");
        const numB = parseInt(b.match(/\d+/)?.[0] || "0");
        return numA - numB;
      });
      
      return sortedPositions;
    }
    
    // If no tire positions found, try to get from maintenance records for this device
    const deviceMaintenances = tireMaintenances.filter(m => {
      const maintenanceDeviceId = m.deviceId || m.attributes?.deviceId || m.id;
      return Number(device.id) === Number(maintenanceDeviceId);
    });
    
    // Collect all unique tire slots from maintenance records
    const maintenanceSlots = new Set<string>();
    deviceMaintenances.forEach(m => {
      const slot = m.attributes?.tireSlot as string;
      if (slot) {
        maintenanceSlots.add(slot);
      } else {
        // Fallback to tirePosition if tireSlot not available
        const pos = m.attributes?.tirePosition as string;
        if (pos && pos.startsWith("T") && !pos.match(/^T\d+$/)) {
          // If it's a slot-based position (TFL, TFR, etc.), use it
          maintenanceSlots.add(pos);
        }
      }
    });
    
    if (maintenanceSlots.size > 0) {
      const sortedMaintenanceSlots = Array.from(maintenanceSlots).sort((a, b) => {
        // Front tires first
        if (a.startsWith("TF") && !b.startsWith("TF")) return -1;
        if (!a.startsWith("TF") && b.startsWith("TF")) return 1;
        
        // Then by side (L before R)
        if (a.includes("L") && b.includes("R")) return -1;
        if (a.includes("R") && b.includes("L")) return 1;
        
        // Then by number
        const numA = parseInt(a.match(/\d+/)?.[0] || "0");
        const numB = parseInt(b.match(/\d+/)?.[0] || "0");
        return numA - numB;
      });
      
      return sortedMaintenanceSlots;
    }
    
    // Default fallback: assume 4-wheeler
    return TIRE_POSITIONS_4W;
  }, [tireMaintenances]);

  // Filter tire maintenances by selected vehicle
  const filteredTireMaintenances = useMemo(() => {
    if (selectedVehicleFilter === "all") {
      return tireMaintenances;
    }
    const deviceId = parseInt(selectedVehicleFilter);
    return tireMaintenances.filter((m) => {
      const maintenanceDeviceId = m.deviceId || m.attributes?.deviceId || m.id;
      return Number(maintenanceDeviceId) === deviceId;
    });
  }, [tireMaintenances, selectedVehicleFilter]);

  // Enrich tire maintenance records with device info
  const enrichedTireMaintenances = useMemo(() => {
    return filteredTireMaintenances.map((maintenance) => {
      const maintenanceDeviceId = maintenance.deviceId || maintenance.attributes?.deviceId || maintenance.id;
      const device = dashboardDevices.find((d) => Number(d.id) === Number(maintenanceDeviceId));

      const totalDistanceMeters =
        device?.position?.attributes?.totalDistance ??
        device?.attributes?.totalDistance ??
        0;
      const currentOdometer = Math.round(totalDistanceMeters / 1000);

      const startOdometer = Math.round(maintenance.start);
      const periodValue = Math.round(maintenance.period);
      const endValue = startOdometer + periodValue;
      const valueTraveled = currentOdometer - startOdometer;
      const valueRemaining = endValue - currentOdometer;
      const progress = periodValue > 0
        ? Math.min(100, Math.max(0, (valueTraveled / periodValue) * 100))
        : 100;

      const isRunning = currentOdometer < endValue;
      const isOverdue = currentOdometer >= endValue;
      const isNear = valueRemaining > 0 && valueRemaining <= 1000;

      let status: "running" | "completed" | "near" | "overdue" = "running";
      if (isOverdue) status = "overdue";
      else if (isNear) status = "near";
      else if (!isRunning) status = "completed";
      else status = "running";

      // Calculate tire positions for this device
      const deviceTirePositions = getTirePositionsFromDevice(device);
      const deviceTireCount = deviceTirePositions.length;
      const vehicleTypeForDevice = deviceTireCount === 4 ? "4-wheeler" : "8-wheeler";

      // Build tire number mapping from device attributes or maintenance records
      const tireNumbers = new Map<string, number>();
      const tirePosition = maintenance.attributes?.tirePosition || "";
      const tireSlot = maintenance.attributes?.tireSlot as string | undefined;
      const tireNumber = maintenance.attributes?.tireNumber as number | undefined;
      
      // If we have a numbered tire position (T1, T2, etc.), extract the number
      if (tirePosition && tirePosition.match(/^T\d+$/)) {
        const num = parseInt(tirePosition.substring(1));
        if (tireSlot && !isNaN(num)) {
          tireNumbers.set(tireSlot, num);
        }
      } else if (tireNumber && tireSlot) {
        // If we have tireNumber and tireSlot attributes, use them
        tireNumbers.set(tireSlot, tireNumber);
      }
      
      // Also try to get tire numbers from device attributes
      if (device) {
        for (let i = 1; i <= 22; i++) {
          const tireKey = `T${i}`;
          const slot = device.attributes?.[`${tireKey}_slot`] as string | undefined;
          if (slot && !tireNumbers.has(slot)) {
            tireNumbers.set(slot, i);
          }
        }
      }

      return {
        ...maintenance,
        deviceName: device?.name || "Unknown Device",
        currentOdometer,
        startOdometer,
        endValue,
        valueTraveled,
        valueRemaining,
        progress,
        status,
        tirePosition: tirePosition,
        tireSlot: tireSlot,
        tireNumber: tireNumber,
        tirePositions: deviceTirePositions,
        tireNumbers: tireNumbers,
        vehicleType: vehicleTypeForDevice,
      };
    }).sort((a, b) => {
      const statusOrder = { overdue: 0, completed: 1, near: 2, running: 3 };
      return (statusOrder[a.status as keyof typeof statusOrder] ?? 4) -
             (statusOrder[b.status as keyof typeof statusOrder] ?? 4);
    });
  }, [filteredTireMaintenances, dashboardDevices, getTirePositionsFromDevice]);

  // Get unique vehicles from tire maintenances
  const availableVehicles = useMemo(() => {
    const vehicles = new Map<number, { id: number; name: string }>();
    tireMaintenances.forEach((maintenance) => {
      const maintenanceDeviceId = maintenance.deviceId || maintenance.attributes?.deviceId || maintenance.id;
      const device = dashboardDevices.find((d) => Number(d.id) === Number(maintenanceDeviceId));
      if (device && !vehicles.has(device.id)) {
        vehicles.set(device.id, { id: device.id, name: device.name });
      }
    });
    return Array.from(vehicles.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [tireMaintenances, dashboardDevices]);

  const handleResetTireMaintenance = async () => {
    if (!maintenanceToReset) return;

    setResetting(true);
    try {
      const device = dashboardDevices.find(d => {
        const maintenanceDeviceId = maintenanceToReset.deviceId || maintenanceToReset.attributes?.deviceId || maintenanceToReset.id;
        return Number(d.id) === Number(maintenanceDeviceId);
      });

      const totalDistanceMeters =
        device?.position?.attributes?.totalDistance ??
        device?.attributes?.totalDistance ??
        0;
      const newStartValue = Math.round(totalDistanceMeters / 1000);

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
          periodUnit: "km",
          startTimestamp: new Date().toISOString(),
          installationDate: new Date().toISOString(), // Update installation date when resetting
        },
      };

      await apiClient.put(`/maintenance/${maintenanceToReset.id}`, updatePayload);
      
      toast({
        title: "Success",
        description: `Tire maintenance "${maintenanceToReset.name}" has been reset.`,
      });
      setResetDialogOpen(false);
      setMaintenanceToReset(null);
      fetchTireMaintenances();
    } catch (error: any) {
      console.error("Failed to reset tire maintenance:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.message || "Failed to reset tire maintenance.",
      });
    } finally {
      setResetting(false);
    }
  };

  const handleDeleteTireMaintenance = async () => {
    if (!maintenanceToDelete) return;

    setDeleting(true);
    try {
      const maintenance = tireMaintenances.find(m => m.id === maintenanceToDelete);
      const deviceId = maintenance?.deviceId || maintenance?.attributes?.deviceId || maintenance?.id;

      if (deviceId) {
        try {
          const params = new URLSearchParams({
            deviceId: deviceId.toString(),
            maintenanceId: maintenanceToDelete.toString(),
          });
          await apiClient.delete(`/permissions?${params.toString()}`);
        } catch (permissionError: any) {
          console.warn("Failed to delete permission:", permissionError);
        }
      }

      await apiClient.delete(`/maintenance/${maintenanceToDelete}`);
      
      toast({
        title: "Success",
        description: "Tire maintenance record deleted successfully.",
      });
      setDeleteDialogOpen(false);
      setMaintenanceToDelete(null);
      fetchTireMaintenances();
    } catch (error: any) {
      console.error("Failed to delete tire maintenance:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.message || "Failed to delete tire maintenance.",
      });
    } finally {
      setDeleting(false);
    }
  };

  // Dashboard status functions (for maintenance records)
  const getMaintenanceStatusColor = (status: string) => {
    switch (status) {
      case "overdue":
        return "destructive";
      case "near":
        return "default";
      case "completed":
        return "secondary";
      default:
        return "secondary";
    }
  };

  const getMaintenanceStatusIcon = (status: string) => {
    switch (status) {
      case "overdue":
        return <AlertTriangle className="h-4 w-4" />;
      case "near":
        return <Clock className="h-4 w-4" />;
      case "completed":
        return <CheckCircle2 className="h-4 w-4" />;
      default:
        return <CheckCircle2 className="h-4 w-4" />;
    }
  };

  return (
    <CardContent className="space-y-6">
      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList>
          <TabsTrigger value="dashboard">
            <Circle className="mr-2 h-4 w-4" />
            Tire Dashboard
          </TabsTrigger>
          <TabsTrigger value="install">
            <Wrench className="mr-2 h-4 w-4" />
            Install Tires
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="space-y-4 mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Tire Record</h3>
                    <p className="text-sm text-muted-foreground">
                      {enrichedTireMaintenances.length} tire record
                      {enrichedTireMaintenances.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Select
                    value={selectedVehicleFilter}
                    onValueChange={setSelectedVehicleFilter}
                  >
                    <SelectTrigger className="w-full sm:w-[200px]">
                      <SelectValue placeholder="Filter by vehicle" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Vehicles</SelectItem>
                      {availableVehicles.map((vehicle) => (
                        <SelectItem key={vehicle.id} value={vehicle.id.toString()}>
                          {vehicle.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex flex-wrap gap-2">
                    {selectedVehicleFilter !== "all" && (
                      <>
                        <Button
                          onClick={() => setReplaceAllDialogOpen(true)}
                          variant="outline"
                          size="sm"
                          disabled={enrichedTireMaintenances.length === 0}
                          className="flex-1 sm:flex-initial"
                        >
                          <RotateCw className="mr-2 h-4 w-4" />
                          Replace All
                        </Button>
                        <Button
                          onClick={() => setDeleteAllDialogOpen(true)}
                          variant="outline"
                          size="sm"
                          disabled={enrichedTireMaintenances.length === 0}
                          className="text-destructive hover:text-destructive flex-1 sm:flex-initial"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete All
                        </Button>
                      </>
                    )}
                    <Button
                      onClick={fetchTireMaintenances}
                      disabled={dashboardLoading}
                      variant="outline"
                      size="sm"
                      className="flex-1 sm:flex-initial"
                    >
                      {dashboardLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        "Refresh"
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {dashboardLoading && enrichedTireMaintenances.length === 0 ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                    <p>Loading tire maintenance records...</p>
                  </div>
                </div>
              ) : enrichedTireMaintenances.length === 0 ? (
                <div className="flex items-center justify-center h-64 border border-dashed rounded-lg">
                  <div className="text-center text-muted-foreground">
                    <Circle className="h-8 w-8 mx-auto mb-2" />
                    <p>No tire maintenance records</p>
                    <p className="text-sm">Install tires to create maintenance records</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {enrichedTireMaintenances.map((maintenance) => {
                    // Extract maintenance name without type (e.g., "Tire 1" from "Vehicle - Tire Replacement - Tire 1")
                    const getMaintenanceDisplayName = () => {
                      const tireNumber = (maintenance as any).tireNumber;
                      const tirePosition = maintenance.tirePosition || (maintenance as any).tireSlot;
                      
                      if (tireNumber) {
                        return `Tire ${tireNumber}`;
                      }
                      if (tirePosition) {
                        // If it's a numbered position like T1, T2, extract the number
                        const match = tirePosition.match(/^T(\d+)$/);
                        if (match) {
                          return `Tire ${match[1]}`;
                        }
                        return tirePosition;
                      }
                      
                      // Fallback: try to extract from maintenance name
                      const parts = maintenance.name.split(' - ');
                      if (parts.length >= 3) {
                        return parts[parts.length - 1]; // Last part is usually the tire info
                      }
                      return maintenance.name.split(' - ').pop() || maintenance.name;
                    };

                    const maintenanceDisplayName = getMaintenanceDisplayName();
                    const tireSlot = (maintenance as any).tireSlot || maintenance.tirePosition || "";
                    
                    return (
                      <div
                        key={maintenance.id}
                        className={cn(
                          "p-4 border rounded-lg space-y-3",
                          maintenance.status === "overdue" && "border-red-500 bg-red-50 dark:bg-red-950/20",
                          maintenance.status === "near" && "border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20"
                        )}
                      >
                            {/* Vehicle Diagram and Card Info - Side by side on larger screens */}
                            <div className="flex flex-col md:flex-row md:items-start gap-4 md:gap-6">
                              {/* Bottom Vehicle Diagram */}
                              <div className="flex-shrink-0 w-full md:w-auto flex justify-center md:justify-start">
                                <BottomVehicleDiagram
                                  vehicleType={(maintenance as any).vehicleType || "4-wheeler"}
                                  highlightedTire={tireSlot}
                                  tireStatus={maintenance.status === "overdue" ? "replace" : maintenance.status === "near" ? "warning" : "normal"}
                                  getStatusColor={getTireStatusColor}
                                  tirePositions={(maintenance as any).tirePositions || TIRE_POSITIONS_4W}
                                  tireNumbers={(maintenance as any).tireNumbers}
                                />
                              </div>
                              {/* Card Information */}
                              <div className="flex-1 min-w-0 w-full md:w-auto">
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                  <Circle className="h-5 w-5 text-primary flex-shrink-0" />
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <span className="font-semibold truncate">{maintenance.deviceName}</span>
                                    <span className="text-muted-foreground">•</span>
                                    <span className="font-semibold truncate">{maintenanceDisplayName}</span>
                                  </div>
                                </div>
                                <div className="mb-1 flex items-center gap-2">
                                  <Badge variant={getMaintenanceStatusColor(maintenance.status)} className="flex-shrink-0">
                                    {getMaintenanceStatusIcon(maintenance.status)}
                                    <span className="ml-1 capitalize">{maintenance.status}</span>
                                  </Badge>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                                      onClick={() => {
                                        setMaintenanceToReset(maintenance);
                                        setResetDialogOpen(true);
                                      }}
                                      title="Reset maintenance"
                                    >
                                      <RotateCw className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                      onClick={() => {
                                        setMaintenanceToDelete(maintenance.id);
                                        setDeleteDialogOpen(true);
                                      }}
                                      title="Delete maintenance"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                                {maintenance.attributes?.installationDate && (
                                  <div className="flex items-center">
                                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                                      <span className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        <span>
                                          Date: {new Date(maintenance.attributes.installationDate).toLocaleDateString()}
                                        </span>
                                      </span>
                                    </p>
                                  </div>
                                )}
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
                                <p className="font-medium">{maintenance.endValue} km</p>
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
                                  {Math.abs(maintenance.valueRemaining)} km
                                </p>
                              </div>
                            </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="install" className="space-y-6">
      {/* Vehicle Selection */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="space-y-2">
            <Label>Select Vehicle</Label>
            <Select
              value={selectedDeviceId?.toString() || ""}
              onValueChange={(value) => setSelectedDeviceId(parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a vehicle" />
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

          {selectedDevice && (
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setSelectedTireSlots(new Set());
                  setTireSequence(new Map());
                  setIsTireSelectionDialogOpen(true);
                }}
                className="flex-1"
              >
                <Plus className="mr-2 h-4 w-4" />
                Install New Tires
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tire Status */}
      {selectedDevice && tireData.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-4">Tire Mileage Status</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tireData.map((tire) => (
                <Card
                  key={tire.position}
                  className={cn(
                    "p-4 cursor-pointer hover:shadow-md transition-all",
                    tire.status === "replace" && "border-red-500",
                    highlightedTire === tire.position && "ring-2 ring-primary ring-offset-2"
                  )}
                  onClick={() => {
                    setHighlightedTire(tire.position);
                    setSelectedTirePosition(tire.position);
                    setIsReplaceDialogOpen(true);
                  }}
                  onMouseEnter={() => setHighlightedTire(tire.position)}
                  onMouseLeave={() => setHighlightedTire(null)}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    {/* Vehicle Diagram - Drivetrain View */}
                    <div className="flex justify-center sm:justify-start sm:flex-shrink-0">
                      <BottomVehicleDiagram
                        vehicleType={tireData.length === 4 ? "4-wheeler" : "8-wheeler"}
                        highlightedTire={tire.position}
                        tireStatus={tire.status}
                        getStatusColor={getTireStatusColor}
                        tirePositions={getTirePositionsFromDevice(selectedDevice)}
                      />
                    </div>
                    
                    {/* Tire Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold">{tire.position}</h4>
                        <Badge variant={getTireStatusColor(tire.status)}>
                          {getTireStatusIcon(tire.status)}
                          <span className="ml-1 capitalize">{tire.status}</span>
                        </Badge>
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p>Installed: {(tire.installOdometer / 1000).toFixed(0)} km</p>
                        {tire.installDate && (
                          <p>
                            Installed Date: {new Date(tire.installDate).toLocaleDateString()}
                          </p>
                        )}
                        <p>Current: {(tire.currentOdometer / 1000).toFixed(0)} km</p>
                        <p className="font-medium text-foreground">
                          Mileage: {(tire.mileage / 1000).toFixed(0)} km
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tire Selection Dialog - Step 1 */}
      <Dialog open={isTireSelectionDialogOpen} onOpenChange={setIsTireSelectionDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select Tire Positions</DialogTitle>
            <DialogDescription>
              Click on tire positions to select them. Tires will be numbered sequentially (1, 2, 3...) based on the order you select them.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <InteractiveTireSelection
              selectedSlots={selectedTireSlots}
              tireSequence={tireSequence}
              onSlotToggle={(slot) => {
                const newSelected = new Set(selectedTireSlots);
                const newSequence = new Map(tireSequence);
                
                if (newSelected.has(slot)) {
                  // Deselect - remove from selection and sequence
                  newSelected.delete(slot);
                  const removedNum = newSequence.get(slot);
                  newSequence.delete(slot);
                  
                  // Renumber remaining tires
                  const sortedSlots = Array.from(newSelected).sort((a, b) => {
                    const numA = newSequence.get(a) || 0;
                    const numB = newSequence.get(b) || 0;
                    return numA - numB;
                  });
                  
                  sortedSlots.forEach((s, idx) => {
                    newSequence.set(s, idx + 1);
                  });
                } else {
                  // Select - add to selection and assign next number
                  newSelected.add(slot);
                  const nextNum = newSelected.size;
                  newSequence.set(slot, nextNum);
                }
                
                setSelectedTireSlots(newSelected);
                setTireSequence(newSequence);
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsTireSelectionDialogOpen(false);
                setSelectedTireSlots(new Set());
                setTireSequence(new Map());
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (selectedTireSlots.size === 0) {
                  toast({
                    variant: "destructive",
                    title: "Error",
                    description: "Please select at least one tire position.",
                  });
                  return;
                }
                setIsTireSelectionDialogOpen(false);
                setIsInstallDialogOpen(true);
              }}
              disabled={loading || selectedTireSlots.size === 0}
            >
              Next: Set Odometer ({selectedTireSlots.size} tire{selectedTireSlots.size !== 1 ? "s" : ""})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Install Tires Dialog - Step 2 */}
      <Dialog open={isInstallDialogOpen} onOpenChange={setIsInstallDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Install New Tires</DialogTitle>
            <DialogDescription>
              Set the current odometer reading when installing {selectedTireSlots.size} new tire{selectedTireSlots.size !== 1 ? "s" : ""} for{" "}
              {selectedDevice?.name}. A separate maintenance record will be created for each tire.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Odometer Reading (km)</Label>
              <Input
                type="number"
                min="0"
                value={installOdometer}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  setInstallOdometer(value >= 0 ? value : 0);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Current odometer: {(currentOdometer / 1000).toFixed(0)} km
              </p>
            </div>
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm font-medium mb-2">Selected Tires ({selectedTireSlots.size} tire{selectedTireSlots.size !== 1 ? "s" : ""}):</p>
              <div className="space-y-1">
                {Array.from(selectedTireSlots)
                  .sort((a, b) => {
                    const numA = tireSequence.get(a) || 0;
                    const numB = tireSequence.get(b) || 0;
                    return numA - numB;
                  })
                  .map((slot) => {
                    const tireNumber = tireSequence.get(slot);
                    return (
                      <p key={slot} className="text-xs text-muted-foreground">
                        Tire {tireNumber}: {slot}
                      </p>
                    );
                  })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsInstallDialogOpen(false);
                setIsTireSelectionDialogOpen(true);
              }}
              disabled={loading}
            >
              Back
            </Button>
            <Button onClick={handleInstallTires} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Install {selectedTireSlots.size} Tire{selectedTireSlots.size !== 1 ? "s" : ""} & Create Maintenance Records
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Replace Tire Dialog */}
      <Dialog 
        open={isReplaceDialogOpen} 
        onOpenChange={(open) => {
          setIsReplaceDialogOpen(open);
          if (!open) {
            setHighlightedTire(null);
            setSelectedTirePosition("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace Tire</DialogTitle>
            <DialogDescription>
              Replace {selectedTirePosition} tire for {selectedDevice?.name} at
              current odometer reading
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Current odometer: {(currentOdometer / 1000).toFixed(0)} km
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              This will update the tire installation odometer to the current
              value.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsReplaceDialogOpen(false);
                setHighlightedTire(null);
                setSelectedTirePosition("");
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button 
              onClick={async () => {
                await handleReplaceTire();
                setHighlightedTire(null);
              }} 
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Replace Tire
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </TabsContent>
      </Tabs>

      {/* Reset Dialog */}
      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Tire Maintenance</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reset "{maintenanceToReset?.name}"? 
              The maintenance period will restart from the current odometer reading.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetTireMaintenance}
              disabled={resetting}
              className="bg-primary text-primary-foreground"
            >
              {resetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reset Maintenance
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tire Maintenance</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this tire maintenance record? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTireMaintenance}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground"
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

      {/* Replace All Tires Dialog */}
      <AlertDialog open={replaceAllDialogOpen} onOpenChange={setReplaceAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace All Tires</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to replace all {enrichedTireMaintenances.length} tire{enrichedTireMaintenances.length !== 1 ? "s" : ""} for this vehicle? 
              This will reset the maintenance period for all tires from the current odometer reading.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={replacingAll}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (selectedVehicleFilter === "all") return;
                setReplacingAll(true);
                try {
                  const deviceId = parseInt(selectedVehicleFilter);
                  const device = dashboardDevices.find((d) => Number(d.id) === deviceId);
                  
                  if (!device) {
                    toast({
                      variant: "destructive",
                      title: "Error",
                      description: "Device not found.",
                    });
                    return;
                  }

                  const totalDistanceMeters =
                    device?.position?.attributes?.totalDistance ??
                    device?.attributes?.totalDistance ??
                    0;
                  const newStartValue = Math.round(totalDistanceMeters / 1000);

                  // Replace all tire maintenances for this vehicle
                  const replacePromises = enrichedTireMaintenances.map(async (maintenance) => {
                    const updatePayload = {
                      id: maintenance.id,
                      name: maintenance.name,
                      type: maintenance.type,
                      start: newStartValue,
                      period: maintenance.period,
                      attributes: {
                        ...maintenance.attributes,
                        deviceId: maintenance.deviceId || maintenance.attributes?.deviceId || maintenance.id,
                        deviceName: maintenance.deviceName || maintenance.attributes?.deviceName || "",
                        periodUnit: "km",
                        startTimestamp: new Date().toISOString(),
                        installationDate: new Date().toISOString(),
                      },
                    };

                    try {
                      await apiClient.put(`/maintenance/${maintenance.id}`, updatePayload);
                      return { success: true, id: maintenance.id };
                    } catch (error: any) {
                      console.error(`Failed to replace tire ${maintenance.id}:`, error);
                      return { success: false, id: maintenance.id, error };
                    }
                  });

                  const results = await Promise.all(replacePromises);
                  const successCount = results.filter((r) => r.success).length;
                  const failureCount = results.filter((r) => !r.success).length;

                  if (failureCount === 0) {
                    toast({
                      title: "Success",
                      description: `All ${successCount} tire${successCount !== 1 ? "s" : ""} replaced successfully.`,
                    });
                  } else {
                    toast({
                      variant: "default",
                      title: "Partial Success",
                      description: `${successCount} tire${successCount !== 1 ? "s" : ""} replaced, ${failureCount} failed.`,
                    });
                  }

                  setReplaceAllDialogOpen(false);
                  fetchTireMaintenances();
                } catch (error: any) {
                  console.error("Failed to replace all tires:", error);
                  toast({
                    variant: "destructive",
                    title: "Error",
                    description: error.response?.data?.message || "Failed to replace all tires.",
                  });
                } finally {
                  setReplacingAll(false);
                }
              }}
              disabled={replacingAll}
              className="bg-primary text-primary-foreground"
            >
              {replacingAll ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Replacing...
                </>
              ) : (
                "Replace All"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete All Tires Dialog */}
      <AlertDialog open={deleteAllDialogOpen} onOpenChange={setDeleteAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete All Tire Maintenances</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete all {enrichedTireMaintenances.length} tire maintenance record{enrichedTireMaintenances.length !== 1 ? "s" : ""} for this vehicle? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingAll}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (selectedVehicleFilter === "all") return;
                setDeletingAll(true);
                try {
                  // Delete all tire maintenances for this vehicle
                  const deletePromises = enrichedTireMaintenances.map(async (maintenance) => {
                    const deviceId = maintenance.deviceId || maintenance.attributes?.deviceId || maintenance.id;

                    // Delete permission first
                    if (deviceId) {
                      try {
                        const params = new URLSearchParams({
                          deviceId: deviceId.toString(),
                          maintenanceId: maintenance.id.toString(),
                        });
                        await apiClient.delete(`/permissions?${params.toString()}`);
                      } catch (permissionError: any) {
                        console.warn(`Failed to delete permission for maintenance ${maintenance.id}:`, permissionError);
                      }
                    }

                    // Delete maintenance record
                    try {
                      await apiClient.delete(`/maintenance/${maintenance.id}`);
                      return { success: true, id: maintenance.id };
                    } catch (error: any) {
                      console.error(`Failed to delete tire ${maintenance.id}:`, error);
                      return { success: false, id: maintenance.id, error };
                    }
                  });

                  const results = await Promise.all(deletePromises);
                  const successCount = results.filter((r) => r.success).length;
                  const failureCount = results.filter((r) => !r.success).length;

                  if (failureCount === 0) {
                    toast({
                      title: "Success",
                      description: `All ${successCount} tire maintenance record${successCount !== 1 ? "s" : ""} deleted successfully.`,
                    });
                  } else {
                    toast({
                      variant: "default",
                      title: "Partial Success",
                      description: `${successCount} record${successCount !== 1 ? "s" : ""} deleted, ${failureCount} failed.`,
                    });
                  }

                  setDeleteAllDialogOpen(false);
                  setSelectedVehicleFilter("all"); // Reset filter after deletion
                  fetchTireMaintenances();
                } catch (error: any) {
                  console.error("Failed to delete all tires:", error);
                  toast({
                    variant: "destructive",
                    title: "Error",
                    description: error.response?.data?.message || "Failed to delete all tire maintenances.",
                  });
                } finally {
                  setDeletingAll(false);
                }
              }}
              disabled={deletingAll}
              className="bg-destructive text-destructive-foreground"
            >
              {deletingAll ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete All"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CardContent>
  );
}

