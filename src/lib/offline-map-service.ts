"use client";

interface CachedTile {
  url: string;
  data: string; // base64 encoded image data
  timestamp: number;
  zoom: number;
  x: number;
  y: number;
}

export interface OfflineRegion {
  id: string;
  name: string;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  zoomLevels: number[];
  cachedTiles: number;
  totalTiles: number;
  lastUpdated: number;
}

export class OfflineMapService {
  private static instance: OfflineMapService;
  private readonly STORAGE_KEY = 'offline_map_tiles';
  private readonly REGIONS_KEY = 'offline_map_regions';
  private readonly MAX_CACHE_SIZE = 100 * 1024 * 1024; // 100MB
  private readonly TILE_EXPIRY_DAYS = 30;

  private constructor() {}

  static getInstance(): OfflineMapService {
    if (!OfflineMapService.instance) {
      OfflineMapService.instance = new OfflineMapService();
    }
    return OfflineMapService.instance;
  }

  // Convert lat/lng to tile coordinates
  private latLngToTile(lat: number, lng: number, zoom: number): { x: number; y: number } {
    const n = Math.pow(2, zoom);
    const x = Math.floor(((lng + 180) / 360) * n);
    const y = Math.floor(((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2) * n);
    return { x, y };
  }

  // Get tile URL for Google Maps
  private getTileUrl(x: number, y: number, zoom: number): string {
    // Google Maps tile URL format
    return `https://mt1.google.com/vt/lyrs=m&x=${x}&y=${y}&z=${zoom}`;
  }

  // Calculate total tiles needed for a region
  private calculateTilesForRegion(bounds: OfflineRegion['bounds'], zoomLevels: number[]): number {
    let totalTiles = 0;
    
    for (const zoom of zoomLevels) {
      const topLeft = this.latLngToTile(bounds.north, bounds.west, zoom);
      const bottomRight = this.latLngToTile(bounds.south, bounds.east, zoom);
      
      const tilesX = bottomRight.x - topLeft.x + 1;
      const tilesY = bottomRight.y - topLeft.y + 1;
      
      totalTiles += tilesX * tilesY;
    }
    
    return totalTiles;
  }

  // Download and cache a single tile
  private async downloadTile(x: number, y: number, zoom: number): Promise<string | null> {
    try {
      const url = this.getTileUrl(x, y, zoom);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to download tile: ${response.status}`);
      }
      
      const blob = await response.blob();
      const reader = new FileReader();
      
      return new Promise((resolve, reject) => {
        reader.onload = () => {
          const base64 = reader.result as string;
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error downloading tile:', error);
      return null;
    }
  }

  // Cache a tile
  private async cacheTile(x: number, y: number, zoom: number, data: string): Promise<void> {
    const tile: CachedTile = {
      url: this.getTileUrl(x, y, zoom),
      data,
      timestamp: Date.now(),
      zoom,
      x,
      y,
    };

    const cachedTiles = this.getCachedTiles();
    const tileKey = `${zoom}_${x}_${y}`;
    cachedTiles[tileKey] = tile;

    // Clean up old tiles if cache is too large
    await this.cleanupCache();
    
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cachedTiles));
  }

  // Get cached tiles
  private getCachedTiles(): { [key: string]: CachedTile } {
    try {
      const cached = localStorage.getItem(this.STORAGE_KEY);
      return cached ? JSON.parse(cached) : {};
    } catch {
      return {};
    }
  }

  // Get cached tile
  getCachedTile(x: number, y: number, zoom: number): string | null {
    const cachedTiles = this.getCachedTiles();
    const tileKey = `${zoom}_${x}_${y}`;
    const tile = cachedTiles[tileKey];

    if (!tile) return null;

    // Check if tile is expired
    const age = Date.now() - tile.timestamp;
    const maxAge = this.TILE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    
    if (age > maxAge) {
      delete cachedTiles[tileKey];
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cachedTiles));
      return null;
    }

    return tile.data;
  }

  // Download region for offline use
  async downloadRegion(region: Omit<OfflineRegion, 'id' | 'cachedTiles' | 'totalTiles' | 'lastUpdated'>): Promise<OfflineRegion> {
    const regionId = `region_${Date.now()}`;
    const totalTiles = this.calculateTilesForRegion(region.bounds, region.zoomLevels);
    let cachedTiles = 0;

    const offlineRegion: OfflineRegion = {
      id: regionId,
      name: region.name,
      bounds: region.bounds,
      zoomLevels: region.zoomLevels,
      cachedTiles: 0,
      totalTiles,
      lastUpdated: Date.now(),
    };

    // Save region info
    this.saveRegion(offlineRegion);

    // Download tiles for each zoom level
    for (const zoom of region.zoomLevels) {
      const topLeft = this.latLngToTile(region.bounds.north, region.bounds.west, zoom);
      const bottomRight = this.latLngToTile(region.bounds.south, region.bounds.east, zoom);

      for (let x = topLeft.x; x <= bottomRight.x; x++) {
        for (let y = topLeft.y; y <= bottomRight.y; y++) {
          // Check if tile is already cached
          if (this.getCachedTile(x, y, zoom)) {
            cachedTiles++;
            continue;
          }

          // Download tile
          const tileData = await this.downloadTile(x, y, zoom);
          if (tileData) {
            await this.cacheTile(x, y, zoom, tileData);
            cachedTiles++;
          }

          // Update progress
          offlineRegion.cachedTiles = cachedTiles;
          this.saveRegion(offlineRegion);

          // Small delay to prevent overwhelming the server
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }

    offlineRegion.lastUpdated = Date.now();
    this.saveRegion(offlineRegion);

    return offlineRegion;
  }

  // Save region info
  private saveRegion(region: OfflineRegion): void {
    const regions = this.getRegions();
    regions[region.id] = region;
    localStorage.setItem(this.REGIONS_KEY, JSON.stringify(regions));
  }

  // Get all regions
  getRegions(): { [key: string]: OfflineRegion } {
    try {
      const regions = localStorage.getItem(this.REGIONS_KEY);
      return regions ? JSON.parse(regions) : {};
    } catch {
      return {};
    }
  }

  // Delete region
  deleteRegion(regionId: string): void {
    const regions = this.getRegions();
    delete regions[regionId];
    localStorage.setItem(this.REGIONS_KEY, JSON.stringify(regions));
  }

  // Clean up old cache entries
  private async cleanupCache(): Promise<void> {
    const cachedTiles = this.getCachedTiles();
    const entries = Object.entries(cachedTiles);
    
    // Sort by timestamp (oldest first)
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Calculate current cache size (rough estimate)
    let currentSize = 0;
    for (const [, tile] of entries) {
      currentSize += tile.data.length;
    }
    
    // Remove oldest entries if cache is too large
    while (currentSize > this.MAX_CACHE_SIZE && entries.length > 0) {
      const [key, tile] = entries.shift()!;
      currentSize -= tile.data.length;
      delete cachedTiles[key];
    }
    
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cachedTiles));
  }

  // Get cache size info
  getCacheInfo(): { size: number; tileCount: number; regions: number } {
    const cachedTiles = this.getCachedTiles();
    const regions = this.getRegions();
    
    let size = 0;
    for (const tile of Object.values(cachedTiles)) {
      size += tile.data.length;
    }
    
    return {
      size,
      tileCount: Object.keys(cachedTiles).length,
      regions: Object.keys(regions).length,
    };
  }

  // Clear all cache
  clearCache(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.REGIONS_KEY);
  }

  // Check if coordinates are within any cached region
  isLocationCached(lat: number, lng: number, zoom: number): boolean {
    const regions = this.getRegions();
    
    for (const region of Object.values(regions)) {
      if (region.zoomLevels.includes(zoom)) {
        if (lat >= region.bounds.south && lat <= region.bounds.north &&
            lng >= region.bounds.west && lng <= region.bounds.east) {
          return true;
        }
      }
    }
    
    return false;
  }
}
