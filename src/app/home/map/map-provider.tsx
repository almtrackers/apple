
"use client";

import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

export function MapProvider({ children }: { children: React.ReactNode }) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return (
       <div className="flex flex-col items-center justify-center h-[80vh] bg-card rounded-lg">
        <p className="text-destructive font-semibold">Google Maps API Key Missing</p>
        <p className="text-muted-foreground">Please add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to your environment variables.</p>
      </div>
    )
  }

  return (
    <APIProvider 
      apiKey={apiKey}
      onLoad={() => console.log("Maps API loaded.")}
      libraries={['routes']}
    >
      {children}
    </APIProvider>
  );
}
