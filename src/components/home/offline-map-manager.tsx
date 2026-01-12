"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Map, 
  Download, 
  Trash2, 
  Wifi, 
  WifiOff, 
  HardDrive, 
  Loader2,
  AlertCircle,
  CheckCircle,
  Info
} from "lucide-react";
import { OfflineMapService, OfflineRegion } from "@/lib/offline-map-service";
import { useToast } from "@/hooks/use-toast";

export default function OfflineMapManager() {
  const [regions, setRegions] = useState<{ [key: string]: OfflineRegion }>({});
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadingRegion, setDownloadingRegion] = useState<string | null>(null);
  const [newRegion, setNewRegion] = useState({
    name: "",
    north: "",
    south: "",
    east: "",
    west: "",
    zoomLevels: "10,11,12,13,14,15"
  });
  const [cacheInfo, setCacheInfo] = useState({ size: 0, tileCount: 0, regions: 0 });
  const { toast } = useToast();

  const offlineService = OfflineMapService.getInstance();

  useEffect(() => {
    loadRegions();
    updateCacheInfo();
  }, []);

  const loadRegions = () => {
    const loadedRegions = offlineService.getRegions();
    setRegions(loadedRegions);
  };

  const updateCacheInfo = () => {
    const info = offlineService.getCacheInfo();
    setCacheInfo(info);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDownloadRegion = async () => {
    if (!newRegion.name.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a region name",
      });
      return;
    }

    const bounds = {
      north: parseFloat(newRegion.north),
      south: parseFloat(newRegion.south),
      east: parseFloat(newRegion.east),
      west: parseFloat(newRegion.west),
    };

    if (isNaN(bounds.north) || isNaN(bounds.south) || isNaN(bounds.east) || isNaN(bounds.west)) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter valid coordinates",
      });
      return;
    }

    if (bounds.north <= bounds.south || bounds.east <= bounds.west) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Invalid bounds: North must be > South, East must be > West",
      });
      return;
    }

    const zoomLevels = newRegion.zoomLevels.split(',').map(z => parseInt(z.trim())).filter(z => !isNaN(z) && z >= 1 && z <= 18);

    if (zoomLevels.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter valid zoom levels (1-18)",
      });
      return;
    }

    setIsDownloading(true);
    setDownloadingRegion(newRegion.name);

    try {
      const region = await offlineService.downloadRegion({
        name: newRegion.name,
        bounds,
        zoomLevels,
      });

      toast({
        title: "Success",
        description: `Region "${region.name}" downloaded successfully`,
      });

      // Reset form
      setNewRegion({
        name: "",
        north: "",
        south: "",
        east: "",
        west: "",
        zoomLevels: "10,11,12,13,14,15"
      });

      loadRegions();
      updateCacheInfo();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: "Failed to download region. Please try again.",
      });
    } finally {
      setIsDownloading(false);
      setDownloadingRegion(null);
    }
  };

  const handleDeleteRegion = (regionId: string) => {
    const region = regions[regionId];
    if (region) {
      offlineService.deleteRegion(regionId);
      loadRegions();
      updateCacheInfo();
      toast({
        title: "Region Deleted",
        description: `Region "${region.name}" has been deleted`,
      });
    }
  };

  const handleClearCache = () => {
    offlineService.clearCache();
    loadRegions();
    updateCacheInfo();
    toast({
      title: "Cache Cleared",
      description: "All offline map data has been cleared",
    });
  };

  const getProgressPercentage = (region: OfflineRegion): number => {
    return region.totalTiles > 0 ? (region.cachedTiles / region.totalTiles) * 100 : 0;
  };

  return (
    <div className="space-y-6">
      {/* Cache Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Cache Information
          </CardTitle>
          <CardDescription>Current offline map storage usage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{formatBytes(cacheInfo.size)}</div>
              <div className="text-sm text-muted-foreground">Total Size</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{cacheInfo.tileCount.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Cached Tiles</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{cacheInfo.regions}</div>
              <div className="text-sm text-muted-foreground">Regions</div>
            </div>
          </div>
          <div className="mt-4 flex justify-center">
            <Button variant="outline" onClick={handleClearCache} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All Cache
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Download New Region */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Download Offline Region
          </CardTitle>
          <CardDescription>Download map tiles for offline use in a specific area</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="regionName">Region Name</Label>
              <Input
                id="regionName"
                placeholder="e.g., Karachi City Center"
                value={newRegion.name}
                onChange={(e) => setNewRegion({ ...newRegion, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="zoomLevels">Zoom Levels</Label>
              <Input
                id="zoomLevels"
                placeholder="10,11,12,13,14,15"
                value={newRegion.zoomLevels}
                onChange={(e) => setNewRegion({ ...newRegion, zoomLevels: e.target.value })}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="north">North Latitude</Label>
              <Input
                id="north"
                placeholder="25.0"
                value={newRegion.north}
                onChange={(e) => setNewRegion({ ...newRegion, north: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="south">South Latitude</Label>
              <Input
                id="south"
                placeholder="24.8"
                value={newRegion.south}
                onChange={(e) => setNewRegion({ ...newRegion, south: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="east">East Longitude</Label>
              <Input
                id="east"
                placeholder="67.2"
                value={newRegion.east}
                onChange={(e) => setNewRegion({ ...newRegion, east: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="west">West Longitude</Label>
              <Input
                id="west"
                placeholder="66.8"
                value={newRegion.west}
                onChange={(e) => setNewRegion({ ...newRegion, west: e.target.value })}
              />
            </div>
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-500 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Tips for downloading regions:</p>
                <ul className="list-disc list-inside mt-1 space-y-1 text-muted-foreground">
                  <li>Smaller regions with fewer zoom levels download faster</li>
                  <li>Higher zoom levels (15-18) require more storage space</li>
                  <li>Download during off-peak hours for better performance</li>
                  <li>Ensure stable internet connection during download</li>
                </ul>
              </div>
            </div>
          </div>

          <Button 
            onClick={handleDownloadRegion} 
            disabled={isDownloading}
            className="w-full"
          >
            {isDownloading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download Region
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Downloaded Regions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Map className="h-5 w-5" />
            Downloaded Regions
          </CardTitle>
          <CardDescription>Manage your offline map regions</CardDescription>
        </CardHeader>
        <CardContent>
          {Object.keys(regions).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Map className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No offline regions downloaded yet</p>
              <p className="text-sm">Download a region above to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.values(regions).map((region) => (
                <div key={region.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold">{region.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        Downloaded {new Date(region.lastUpdated).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {downloadingRegion === region.name ? (
                        <Badge variant="secondary">
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Downloading
                        </Badge>
                      ) : getProgressPercentage(region) === 100 ? (
                        <Badge variant="default" className="bg-green-500">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Complete
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Partial
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteRegion(region.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span>{region.cachedTiles} / {region.totalTiles} tiles</span>
                    </div>
                    <Progress value={getProgressPercentage(region)} className="h-2" />
                  </div>
                  
                  <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Zoom Levels:</span>
                      <div className="font-medium">{region.zoomLevels.join(', ')}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Bounds:</span>
                      <div className="font-medium">
                        {region.bounds.north.toFixed(2)}°N, {region.bounds.south.toFixed(2)}°S
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Longitude:</span>
                      <div className="font-medium">
                        {region.bounds.west.toFixed(2)}°W, {region.bounds.east.toFixed(2)}°E
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Status:</span>
                      <div className="font-medium">
                        {getProgressPercentage(region) === 100 ? 'Ready' : 'Incomplete'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
