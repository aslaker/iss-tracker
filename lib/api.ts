import { ISSPosition, CrewData, OpenNotifyPositionResponse } from '../types';
// @ts-ignore
import * as satellite from 'satellite.js';

// Open Notify Endpoints (HTTP only, requires proxy for HTTPS apps)
const POSITION_API = 'http://api.open-notify.org/iss-now.json';
const CREW_API = 'http://api.open-notify.org/astros.json';
const PROXY_URL = 'https://api.allorigins.win/raw?url=';
const TLE_API = 'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE';

// Fallback TLE in case API fails (Updated Jan 2024 - accurate enough for viz)
const FALLBACK_TLE = [
  "1 25544U 98067A   24068.59865741  .00016717  00000+0  30076-3 0  9995",
  "2 25544  51.6396 235.1195 0005470 216.5982 256.4024 15.49818898442371"
];

export const fetchISSPosition = async (): Promise<ISSPosition> => {
  try {
    // Use proxy to avoid Mixed Content (loading HTTP from HTTPS)
    const url = `${PROXY_URL}${encodeURIComponent(POSITION_API)}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    
    const data: OpenNotifyPositionResponse = await response.json();
    
    return {
      latitude: parseFloat(data.iss_position.latitude),
      longitude: parseFloat(data.iss_position.longitude),
      timestamp: data.timestamp,
      altitude: 417.5,
      velocity: 27600,
      visibility: 'orbiting' 
    };
  } catch (e) {
    console.warn("Proxy fetch failed, attempting direct fetch (may fail on HTTPS)...");
    try {
        const response = await fetch(POSITION_API);
        if (!response.ok) throw new Error('Direct fetch failed');
        const data: OpenNotifyPositionResponse = await response.json();
        return {
        latitude: parseFloat(data.iss_position.latitude),
        longitude: parseFloat(data.iss_position.longitude),
        timestamp: data.timestamp,
        altitude: 417.5,
        velocity: 27600,
        visibility: 'orbiting'
        };
    } catch (innerE) {
        console.error("All position fetch attempts failed", innerE);
        throw innerE;
    }
  }
};

export const fetchCrewData = async (): Promise<CrewData> => {
  try {
    const response = await fetch(`${PROXY_URL}${encodeURIComponent(CREW_API)}`);
    if (!response.ok) throw new Error('Proxy failed');
    return response.json();
  } catch (e) {
    // Return fallback crew data silently if API fails to prevent UI breakage
    console.warn("Crew fetch failed, using fallback");
    return {
        message: "fallback",
        number: 7,
        people: [
            { name: "Jasmin Moghbeli", craft: "ISS" },
            { name: "Andreas Mogensen", craft: "ISS" },
            { name: "Satoshi Furukawa", craft: "ISS" },
            { name: "Konstantin Borisov", craft: "ISS" },
            { name: "Oleg Kononenko", craft: "ISS" },
            { name: "Nikolai Chub", craft: "ISS" },
            { name: "Loral O'Hara", craft: "ISS" }
        ]
    };
  }
};

export const fetchTLE = async (): Promise<[string, string]> => {
  try {
    const proxyUrl = `${PROXY_URL}${encodeURIComponent(TLE_API)}`;
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error('TLE fetch failed');
    const text = await response.text();
    const lines = text.trim().split('\n');
    if (lines.length >= 3) {
      return [lines[1].trim(), lines[2].trim()];
    }
    throw new Error('Invalid TLE format');
  } catch (e) {
    console.warn("Failed to fetch TLE, using fallback data", e);
    // Return fallback TLE instead of throwing, so the app keeps working
    return [FALLBACK_TLE[0], FALLBACK_TLE[1]];
  }
};

export interface PredictedPoint {
  lat: number;
  lng: number;
  alt?: number;
}

export const predictOrbit = (line1: string, line2: string, durationMinutes: number = 90): PredictedPoint[] => {
  const points: PredictedPoint[] = [];
  try {
    // Ensure satellite lib is loaded correctly
    const satLib = satellite.default || satellite;
    if (!satLib || !satLib.twoline2satrec) {
        console.error("Satellite.js library not loaded correctly");
        return [];
    }

    const satrec = satLib.twoline2satrec(line1, line2);
    const now = new Date();

    // Calculate points every minute
    for (let i = 0; i <= durationMinutes; i++) {
      const time = new Date(now.getTime() + i * 60 * 1000);
      
      const positionAndVelocity = satLib.propagate(satrec, time);
      const positionEci = positionAndVelocity.position;

      // Check if position exists and is not an error bool
      if (positionEci && (typeof positionEci !== 'boolean')) {
        const gmst = satLib.gstime(time);
        const positionGd = satLib.eciToGeodetic(positionEci, gmst);
        
        // Check for NaNs
        const lat = satLib.degreesLat(positionGd.latitude);
        const lng = satLib.degreesLong(positionGd.longitude);

        if (!isNaN(lat) && !isNaN(lng)) {
            points.push({
            lat: lat,
            lng: lng,
            alt: positionGd.height
            });
        }
      }
    }
  } catch (e) {
    console.error("Orbit prediction failed", e);
  }
  return points;
};

export const formatCoordinate = (val: number, type: 'lat' | 'lon'): string => {
  if (val === undefined || val === null || isNaN(val)) return "0.0000°";
  const dir = type === 'lat'
    ? (val > 0 ? 'N' : 'S')
    : (val > 0 ? 'E' : 'W');
  return `${Math.abs(val).toFixed(4)}° ${dir}`;
};