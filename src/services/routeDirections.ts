import { apiClient } from '../api/client';
export type DriverRoute = {
  points: Array<{latitude:number;longitude:number}>;
  distanceMeters: number; durationSeconds: number;
  steps: Array<{instruction:string;distanceMeters:number;endLocation?:{latitude:number;longitude:number}}>;
};
// Decode Google encoded polyline
export const decodePolyline = (encoded: string): Array<{ latitude: number; longitude: number }> => {
  const points: Array<{ latitude: number; longitude: number }> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }

  return points;
};


export async function fetchDriverRoute(origin: {latitude:number;longitude:number}, destination: {lat:number;lng:number}, signal: AbortSignal): Promise<DriverRoute> {
  const {data}=await apiClient.get('/maps/directions', {params: {
    originLat:origin.latitude,originLng:origin.longitude,destLat:destination.lat,destLng:destination.lng,
  }, signal});
  if (!data.polyline) throw new Error(data.error || 'Route unavailable');
  return {points:decodePolyline(data.polyline),distanceMeters:data.distanceMeters,durationSeconds:data.durationSeconds,steps:data.steps ?? []};
}
