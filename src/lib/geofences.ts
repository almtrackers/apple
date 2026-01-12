export type GeofenceGeometry = "CIRCLE" | "POLYGON" | "LINESTRING";

export interface Geofence {
  id: number;
  name: string;
  area: string;
}

export interface ParsedGeofence extends Geofence {
  geometry?: GeofenceGeometry;
  center?: google.maps.LatLngLiteral;
  radius?: number;
  path?: google.maps.LatLngLiteral[];
}

const toNumberPair = (token: string): [number, number] | null => {
  const [latStr, lngStr] = token.trim().split(/\s+/);
  if (!latStr || !lngStr) return null;
  const lat = Number(latStr);
  const lng = Number(lngStr);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return [lat, lng];
};

export function parseGeofenceArea(area: string): Partial<ParsedGeofence> {
  const s = area.trim();

  const mCircle = s.match(/CIRCLE\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*,\s*([-\d.]+)\s*\)/i);
  if (mCircle) {
    const [, lat, lng, r] = mCircle;
    const latitude = Number(lat);
    const longitude = Number(lng);
    const radius = Number(r);
    if ([latitude, longitude, radius].some(v => Number.isNaN(v))) {
      return {};
    }
    return {
      geometry: "CIRCLE",
      center: { lat: latitude, lng: longitude },
      radius,
    };
  }

  const mPoly = s.match(/POLYGON\s*\(\(\s*([^)]+)\)\)/i);
  if (mPoly) {
    const coords = mPoly[1]
      .split(",")
      .map(toNumberPair)
      .filter((pair): pair is [number, number] => pair !== null)
      .map(([lat, lng]) => ({ lat, lng }));

    if (coords.length > 1) {
      const first = coords[0];
      const last = coords[coords.length - 1];
      if (first.lat === last.lat && first.lng === last.lng) {
        coords.pop();
      }
    }

    return {
      geometry: "POLYGON",
      path: coords,
    };
  }

  const mLine = s.match(/LINESTRING\s*\(\s*([^)]+)\)/i);
  if (mLine) {
    const coords = mLine[1]
      .split(",")
      .map(toNumberPair)
      .filter((pair): pair is [number, number] => pair !== null)
      .map(([lat, lng]) => ({ lat, lng }));

    return {
      geometry: "LINESTRING",
      path: coords,
    };
  }

  return {};
}

export function mapParsedGeofence(geofence: Geofence): ParsedGeofence {
  return {
    ...geofence,
    ...parseGeofenceArea(geofence.area),
  };
}

