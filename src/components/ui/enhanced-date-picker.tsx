"use client";

import { useState, useEffect } from "react";
import { format, subDays, subWeeks, subMonths, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface PresetOption {
  label: string;
  value: string;
  getDateRange: () => DateRange;
}

interface EnhancedDatePickerProps {
  date?: DateRange;
  onDateChange: (date: DateRange | undefined) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

const presetOptions: PresetOption[] = [
  {
    label: "Today",
    value: "today",
    getDateRange: () => ({
      from: startOfDay(new Date()),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: "Yesterday",
    value: "yesterday",
    getDateRange: () => ({
      from: startOfDay(subDays(new Date(), 1)),
      to: endOfDay(subDays(new Date(), 1)),
    }),
  },
  {
    label: "Last 7 days",
    value: "last7days",
    getDateRange: () => ({
      from: startOfDay(subDays(new Date(), 6)),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: "Last 14 days",
    value: "last14days",
    getDateRange: () => ({
      from: startOfDay(subDays(new Date(), 13)),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: "Last 30 days",
    value: "last30days",
    getDateRange: () => ({
      from: startOfDay(subDays(new Date(), 29)),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: "This week",
    value: "thisweek",
    getDateRange: () => ({
      from: startOfWeek(new Date()),
      to: endOfWeek(new Date()),
    }),
  },
  {
    label: "Last week",
    value: "lastweek",
    getDateRange: () => {
      const lastWeek = subWeeks(new Date(), 1);
      return {
        from: startOfWeek(lastWeek),
        to: endOfWeek(lastWeek),
      };
    },
  },
  {
    label: "This month",
    value: "thismonth",
    getDateRange: () => ({
      from: startOfMonth(new Date()),
      to: endOfMonth(new Date()),
    }),
  },
  {
    label: "Last month",
    value: "lastmonth",
    getDateRange: () => {
      const lastMonth = subMonths(new Date(), 1);
      return {
        from: startOfMonth(lastMonth),
        to: endOfMonth(lastMonth),
      };
    },
  },
  {
    label: "Last 3 months",
    value: "last3months",
    getDateRange: () => ({
      from: startOfDay(subMonths(new Date(), 3)),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: "Last 6 months",
    value: "last6months",
    getDateRange: () => ({
      from: startOfDay(subMonths(new Date(), 6)),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: "Last year",
    value: "lastyear",
    getDateRange: () => ({
      from: startOfDay(subMonths(new Date(), 12)),
      to: endOfDay(new Date()),
    }),
  },
];

export function EnhancedDatePicker({
  date,
  onDateChange,
  className,
  placeholder = "Pick a date range",
  disabled = false,
}: EnhancedDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handlePresetSelect = (presetValue: string) => {
    if (presetValue === "custom") {
      setSelectedPreset("custom");
      return;
    }

    const preset = presetOptions.find(p => p.value === presetValue);
    if (preset) {
      const dateRange = preset.getDateRange();
      onDateChange(dateRange);
      setSelectedPreset(presetValue);
      setIsOpen(false);
    }
  };

  const handleCustomDateSelect = (selectedDate: DateRange | undefined) => {
    onDateChange(selectedDate);
    if (selectedDate?.from && selectedDate?.to) {
      setSelectedPreset("custom");
    }
  };

  const formatDateRange = (dateRange: DateRange | undefined): string => {
    if (!dateRange?.from) return placeholder;
    
    if (dateRange.to) {
      return `${format(dateRange.from, "LLL dd, y")} - ${format(dateRange.to, "LLL dd, y")}`;
    }
    
    return format(dateRange.from, "LLL dd, y");
  };

  const getPresetLabel = (): string => {
    if (selectedPreset === "custom") return "Custom Range";
    const preset = presetOptions.find(p => p.value === selectedPreset);
    return preset ? preset.label : "Select preset";
  };

  return (
    <div className={cn("flex flex-col sm:flex-row gap-2", className)}>
      {/* Preset Selector */}
      <Select value={selectedPreset} onValueChange={handlePresetSelect} disabled={disabled}>
        <SelectTrigger className="w-full sm:w-[140px]">
          <SelectValue placeholder="Presets" />
        </SelectTrigger>
        <SelectContent>
          {presetOptions.map((preset) => (
            <SelectItem key={preset.value} value={preset.value}>
              {preset.label}
            </SelectItem>
          ))}
          <SelectItem value="custom">Custom Range</SelectItem>
        </SelectContent>
      </Select>

      {/* Date Range Picker */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full sm:w-[280px] justify-start text-left font-normal text-xs sm:text-sm",
              !date && "text-muted-foreground"
            )}
            disabled={disabled}
          >
            <CalendarIcon className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
            <span className="truncate">{formatDateRange(date)}</span>
            <ChevronDown className="ml-auto h-3 w-3 sm:h-4 sm:w-4 opacity-50 flex-shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 max-w-[95vw] sm:max-w-none" align="start">
          <div className="flex flex-col sm:flex-row max-h-[90vh] overflow-y-auto">
            {/* Preset Options Sidebar */}
            <div className="border-r-0 sm:border-r border-b sm:border-b-0 p-2 sm:p-3 min-w-0 sm:min-w-[200px] max-h-[200px] sm:max-h-none overflow-y-auto">
              <h4 className="font-medium text-xs sm:text-sm mb-2 sm:mb-3">Quick Select</h4>
              <div className="space-y-1">
                {presetOptions.map((preset) => (
                  <Button
                    key={preset.value}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-left h-7 sm:h-8 text-xs sm:text-sm"
                    onClick={() => handlePresetSelect(preset.value)}
                  >
                    {preset.label}
                  </Button>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-left h-7 sm:h-8 text-xs sm:text-sm"
                  onClick={() => handlePresetSelect("custom")}
                >
                  Custom Range
                </Button>
              </div>
            </div>

            {/* Calendar */}
            <div className="p-2 sm:p-3 overflow-x-auto">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={date?.from}
                selected={date}
                onSelect={handleCustomDateSelect}
                numberOfMonths={isMobile ? 1 : 2}
                className="rounded-md border-0"
                disabled={(date) => {
                  // Disable all future dates (after today)
                  const today = new Date();
                  today.setHours(23, 59, 59, 999); // End of today
                  return date > today;
                }}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// Compact version for smaller spaces
export function CompactDatePicker({
  date,
  onDateChange,
  className,
  placeholder = "Pick dates",
  disabled = false,
}: EnhancedDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handlePresetSelect = (presetValue: string) => {
    if (presetValue === "custom") {
      setIsOpen(true);
      return;
    }

    const preset = presetOptions.find(p => p.value === presetValue);
    if (preset) {
      const dateRange = preset.getDateRange();
      onDateChange(dateRange);
    }
  };

  const formatDateRange = (dateRange: DateRange | undefined): string => {
    if (!dateRange?.from) return placeholder;
    
    if (dateRange.to) {
      return `${format(dateRange.from, "MMM dd")} - ${format(dateRange.to, "MMM dd")}`;
    }
    
    return format(dateRange.from, "MMM dd");
  };

  return (
    <div className={cn("flex gap-1", className)}>
      {/* Quick Presets */}
      <Select onValueChange={handlePresetSelect} disabled={disabled}>
        <SelectTrigger className="w-[100px] h-9">
          <SelectValue placeholder="Quick" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="today">Today</SelectItem>
          <SelectItem value="yesterday">Yesterday</SelectItem>
          <SelectItem value="last7days">7 days</SelectItem>
          <SelectItem value="last30days">30 days</SelectItem>
          <SelectItem value="custom">Custom</SelectItem>
        </SelectContent>
      </Select>

      {/* Date Display */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "w-[140px] justify-start text-left font-normal h-9",
              !date && "text-muted-foreground"
            )}
            disabled={disabled}
          >
            <CalendarIcon className="mr-2 h-3 w-3" />
            {formatDateRange(date)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={onDateChange}
            numberOfMonths={2}
            className="rounded-md border-0"
            disabled={(date) => {
              // Disable all future dates (after today)
              const today = new Date();
              today.setHours(23, 59, 59, 999); // End of today
              return date > today;
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
