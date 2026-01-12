
"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { subDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { EnhancedDatePicker } from "@/components/ui/enhanced-date-picker";
import { DateRange } from "react-day-picker";

interface PlaybackDateRangeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelectRange: (range: { from: Date, to: Date }) => void;
}

export default function PlaybackDateRangeDialog({ open, onOpenChange, onSelectRange }: PlaybackDateRangeDialogProps) {
    const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined);
    const now = new Date();

    const ranges = [
        {
            label: "Today",
            getRange: () => ({
                from: startOfDay(now),
                to: endOfDay(now),
            }),
        },
        {
            label: "Yesterday",
            getRange: () => ({
                from: startOfDay(subDays(now, 1)),
                to: endOfDay(subDays(now, 1)),
            }),
        },
        {
            label: "Last 3 Days",
            getRange: () => ({
                from: startOfDay(subDays(now, 2)),
                to: endOfDay(now),
            }),
        },
        {
            label: "Last Week",
            getRange: () => ({
                from: startOfWeek(subDays(now, 7)),
                to: endOfWeek(subDays(now, 7)),
            }),
        },
        {
            label: "This Month",
            getRange: () => ({
                from: startOfMonth(now),
                to: endOfDay(now),
            }),
        },
    ];

    const handleSelect = (range: { from: Date, to: Date }) => {
        onSelectRange(range);
        setCustomDateRange(undefined);
        onOpenChange(false);
    };

    const handleCustomDateSelect = () => {
        if (customDateRange?.from && customDateRange?.to) {
            handleSelect({
                from: startOfDay(customDateRange.from),
                to: endOfDay(customDateRange.to),
            });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Select Playback Range</DialogTitle>
                    <DialogDescription>
                        Choose a preset period or select a custom date range for playback.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-6 py-4">
                    {/* Preset Options */}
                    <div>
                        <h3 className="text-sm font-medium mb-3">Quick Select</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {ranges.map(({ label, getRange }) => (
                                <Button
                                    key={label}
                                    variant="outline"
                                    onClick={() => handleSelect(getRange())}
                                    className="justify-start"
                                >
                                    {label}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <Separator />

                    {/* Custom Date Picker */}
                    <div>
                        <h3 className="text-sm font-medium mb-3">Custom Period</h3>
                        <div className="flex flex-col gap-3">
                            <EnhancedDatePicker
                                date={customDateRange}
                                onDateChange={setCustomDateRange}
                                placeholder="Select custom date range"
                            />
                            <Button
                                onClick={handleCustomDateSelect}
                                disabled={!customDateRange?.from || !customDateRange?.to}
                                className="w-full"
                            >
                                Use Custom Range
                            </Button>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
