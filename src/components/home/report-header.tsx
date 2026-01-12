"use client";

import { CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EnhancedDatePicker } from "@/components/ui/enhanced-date-picker";
import { DateRange } from "react-day-picker";
import { RefreshCw, Download, Filter } from "lucide-react";

interface Device {
  id: number;
  name: string;
}

interface ReportHeaderProps {
  title: string;
  description: string;
  devices: Device[];
  selectedDeviceId: string;
  onDeviceChange: (deviceId: string) => void;
  date: DateRange | undefined;
  onDateChange: (date: DateRange | undefined) => void;
  onRefresh: () => void;
  loading?: boolean;
  showExport?: boolean;
  onExport?: () => void;
  showFilters?: boolean;
  onFiltersClick?: () => void;
  className?: string;
}

export function ReportHeader({
  title,
  description,
  devices,
  selectedDeviceId,
  onDeviceChange,
  date,
  onDateChange,
  onRefresh,
  loading = false,
  showExport = false,
  onExport,
  showFilters = false,
  onFiltersClick,
  className = "",
}: ReportHeaderProps) {
  return (
    <CardHeader className={className}>
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex-1">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
          {/* Device Selector */}
          <Select value={selectedDeviceId} onValueChange={onDeviceChange}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Select Device" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Devices</SelectItem>
              {devices.map(device => (
                <SelectItem key={device.id} value={device.id.toString()}>
                  {device.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Enhanced Date Picker */}
          <EnhancedDatePicker
            date={date}
            onDateChange={onDateChange}
            className="w-full sm:w-auto"
            placeholder="Select date range"
          />

          {/* Action Buttons */}
          <div className="flex gap-2">
            {showFilters && onFiltersClick && (
              <Button
                variant="outline"
                size="sm"
                onClick={onFiltersClick}
                className="flex-shrink-0"
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
              </Button>
            )}
            
            {showExport && onExport && (
              <Button
                variant="outline"
                size="sm"
                onClick={onExport}
                className="flex-shrink-0"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            )}
            
            <Button
              onClick={onRefresh}
              disabled={loading}
              className="flex-shrink-0"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {loading ? "Loading..." : "Refresh"}
            </Button>
          </div>
        </div>
      </div>
    </CardHeader>
  );
}
