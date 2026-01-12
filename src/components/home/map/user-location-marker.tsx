"use client";

import { AdvancedMarker } from "@vis.gl/react-google-maps";

interface UserLocationMarkerProps {
    latitude: number;
    longitude: number;
    heading?: number; // Optional heading/bearing in degrees (0-360)
}

export default function UserLocationMarker({ latitude, longitude, heading = 0 }: UserLocationMarkerProps) {
    return (
        <AdvancedMarker
            position={{ lat: latitude, lng: longitude }}
            title="My Location"
        >
            <div className="relative flex items-center justify-center">
                {/* Pulsing circle animation */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="absolute w-8 h-8 bg-blue-500/30 rounded-full animate-ping"></div>
                    <div className="absolute w-6 h-6 bg-blue-500/40 rounded-full animate-pulse"></div>
                </div>
                {/* Round marker with arrow */}
                <div className="relative z-10 flex items-center justify-center">
                    {/* Outer circle */}
                    <div className="w-5 h-5 rounded-full bg-blue-600 border-2 border-white shadow-lg flex items-center justify-center relative">
                        {/* Inner dot */}
                        <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                    </div>
                    {/* Arrow pointing in heading direction - positioned above the circle */}
                    {heading !== undefined && (
                        <div 
                            className="absolute -top-2 left-1/2"
                            style={{ 
                                transform: `translateX(-50%) rotate(${heading}deg)`,
                                transformOrigin: '50% 100%'
                            }}
                        >
                            <svg 
                                width="8" 
                                height="8" 
                                viewBox="0 0 8 8" 
                                fill="none" 
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path 
                                    d="M4 0L7 4H5L5 8H3L3 4H1L4 0Z" 
                                    fill="blue-600" 
                                    stroke="white" 
                                    strokeWidth="0.5"
                                />
                            </svg>
                        </div>
                    )}
                </div>
            </div>
        </AdvancedMarker>
    );
}

