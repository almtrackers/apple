
"use client";

interface SpeedometerProps {
  speed: number;
}

const MAX_SPEED = 200; // km/h

export default function Speedometer({ speed }: SpeedometerProps) {
    const safeSpeed = Math.min(Math.max(speed, 0), MAX_SPEED);
    const degrees = (safeSpeed / MAX_SPEED) * 180 - 90;

    return (
        <div className="flex flex-col items-center justify-end">
            <div className="relative hidden sm:block sm:w-40 md:w-48 sm:h-20 md:h-24 overflow-hidden rounded-t-full bg-muted/50 border-b-4 border-primary">
                <div className="absolute top-0 left-0 w-full h-full">
                    <div
                        className="absolute bottom-0 left-1/2 w-1 h-16 md:h-20 bg-red-500 origin-bottom transition-transform duration-500"
                        style={{ transform: `translateX(-50%) rotate(${degrees}deg)` }}
                    ></div>
                </div>
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-3 md:w-4 md:h-4 bg-card rounded-full z-10"></div>
            </div>
            <div className="sm:mt-2 text-center p-2 bg-card/80 rounded-lg shadow-md">
                <span className="text-2xl sm:text-3xl font-bold text-primary">
                    {Math.round(safeSpeed)}
                </span>
                <span className="text-xs sm:text-sm text-muted-foreground ml-1">km/h</span>
            </div>
        </div>
    );
}
