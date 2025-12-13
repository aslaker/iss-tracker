import { ISSPosition, CrewData } from '../types';
// @ts-ignore
import * as satellite from 'satellite.js';

// APIs
// Primary: HTTPS, CORS-enabled, Rich Data
const WTIA_API = 'https://api.wheretheiss.at/v1/satellites/25544';
// Fallback: HTTP-only (requires proxy)
const POSITION_API_LEGACY = 'http://api.open-notify.org/iss-now.json';
const CREW_API = 'http://api.open-notify.org/astros.json';
const PROXY_URL = 'https://api.allorigins.win/raw?url=';

// TLE Sources
const TLE_API_PRIMARY = 'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE';
const TLE_API_BACKUP = 'https://live.ariss.org/iss.txt'; 

// Fallback TLE (Updated late 2024)
const FALLBACK_TLE = [
  "1 25544U 98067A   24140.59865741  .00016717  00000+0  30076-3 0  9995",
  "2 25544  51.6396 235.1195 0005470 216.5982 256.4024 15.49818898442371"
];

// Helper: Strict number validation
const isValidNumber = (n: any): boolean => typeof n === 'number' && !isNaN(n) && isFinite(n);

// Helper: Normalize Longitude to -180 to +180
const normalizeLongitude = (lon: number): number => {
  return ((lon + 180) % 360 + 360) % 360 - 180;
};

export const fetchISSPosition = async (): Promise<ISSPosition> => {
  // Strategy: Try Primary HTTPS API first. If it fails, try legacy API via Proxy.
  try {
    const response = await fetch(WTIA_API);
    if (!response.ok) throw new Error(`WTIA API Error: ${response.status}`);
    const data = await response.json();

    if (!isValidNumber(data.latitude) || !isValidNumber(data.longitude)) {
      throw new Error('Invalid coordinates from WTIA');
    }

    return {
      latitude: data.latitude,
      longitude: data.longitude,
      timestamp: data.timestamp,
      altitude: data.altitude, // Actual real-time altitude
      velocity: data.velocity, // Actual real-time velocity
      visibility: data.visibility // 'daylight' or 'eclipsed'
    };
  } catch (primaryError) {
    console.warn("Primary Position API failed, attempting fallback...", primaryError);

    // Fallback path
    try {
      const url = `${PROXY_URL}${encodeURIComponent(POSITION_API_LEGACY)}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Legacy Proxy Error');
      const data = await response.json();
      
      if (!data.iss_position) throw new Error('Invalid legacy structure');

      const lat = parseFloat(data.iss_position.latitude);
      const lon = parseFloat(data.iss_position.longitude);

      if (!isValidNumber(lat) || !isValidNumber(lon)) throw new Error('NaN coordinates');

      return {
        latitude: lat,
        longitude: lon,
        timestamp: data.timestamp,
        altitude: 417.5, // Constant fallback
        velocity: 27600, // Constant fallback
        visibility: 'orbiting'
      };
    } catch (fallbackError) {
      console.error("Critical: All position sources failed.", fallbackError);
      throw fallbackError;
    }
  }
};

export const fetchCrewData = async (): Promise<CrewData> => {
  try {
    const response = await fetch(`${PROXY_URL}${encodeURIComponent(CREW_API)}`);
    if (!response.ok) throw new Error('Crew fetch failed');
    return await response.json();
  } catch (e) {
    console.warn("Crew data fetch failed, using cached manifest.");
    return {
        message: "cached_fallback",
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

const fetchTLEFromUrl = async (url: string): Promise<[string, string]> => {
  // Try direct fetch first (Celestrak supports CORS/HTTPS)
  try {
    const response = await fetch(url);
    if (response.ok) {
      const text = await response.text();
      return parseTLELines(text);
    }
  } catch(e) { /* ignore direct fetch error, try proxy next */ }

  // Try via proxy
  const proxyUrl = `${PROXY_URL}${encodeURIComponent(url)}`;
  const response = await fetch(proxyUrl);
  if (!response.ok) throw new Error(`TLE fetch failed from ${url}`);
  const text = await response.text();
  return parseTLELines(text);
};

const parseTLELines = (text: string): [string, string] => {
  const lines = text.trim().split('\n');
  const line1 = lines.find(l => l.startsWith('1 25544U'));
  const line2 = lines.find(l => l.startsWith('2 25544'));

  if (line1 && line2) {
    return [line1.trim(), line2.trim()];
  }
  throw new Error('Invalid TLE format');
}

export const fetchTLE = async (): Promise<[string, string]> => {
  try {
    return await fetchTLEFromUrl(TLE_API_PRIMARY);
  } catch (e) {
    console.warn("Primary TLE failed, trying backup...");
    try {
      return await fetchTLEFromUrl(TLE_API_BACKUP);
    } catch (backupError) {
      console.warn("All TLE fetches failed, using internal fallback");
      return [FALLBACK_TLE[0], FALLBACK_TLE[1]];
    }
  }
};

export interface PredictedPoint {
  lat: number;
  lng: number;
  alt: number;
}

export const calculateOrbitPath = (line1: string, line2: string, startMins: number, endMins: number, stepMins: number = 1): PredictedPoint[] => {
  const points: PredictedPoint[] = [];
  try {
    const satLib = satellite.default || satellite;
    if (!satLib || !satLib.twoline2satrec) return [];

    const satrec = satLib.twoline2satrec(line1, line2);
    if (!satrec) return [];

    const now = new Date();

    for (let i = startMins; i <= endMins; i += stepMins) {
      const time = new Date(now.getTime() + i * 60 * 1000);
      
      const positionAndVelocity = satLib.propagate(satrec, time);
      const positionEci = positionAndVelocity.position;

      if (positionEci && typeof positionEci !== 'boolean') {
        const gmst = satLib.gstime(time);
        const positionGd = satLib.eciToGeodetic(positionEci, gmst);
        
        const lat = satLib.degreesLat(positionGd.latitude);
        const lng = satLib.degreesLong(positionGd.longitude);
        const alt = positionGd.height;

        if (isValidNumber(lat) && isValidNumber(lng)) {
            points.push({
                lat: lat,
                lng: normalizeLongitude(lng),
                alt: isValidNumber(alt) ? alt : 417
            });
        }
      }
    }
  } catch (e) {
    console.error("Orbit calc error", e);
  }
  return points;
};

// Backwards compatibility alias
export const predictOrbit = (l1: string, l2: string, duration: number) => calculateOrbitPath(l1, l2, 0, duration);

export const formatCoordinate = (val: number, type: 'lat' | 'lon'): string => {
  if (!isValidNumber(val)) return "0.0000°";
  const dir = type === 'lat'
    ? (val > 0 ? 'N' : 'S')
    : (val > 0 ? 'E' : 'W');
  return `${Math.abs(val).toFixed(4)}° ${dir}`;
};

// --- Orbital Solver Utilities ---

export interface OrbitalData {
  inclination: number; // degrees
  eccentricity: number;
  meanMotion: number; // revs per day
  period: number; // minutes
  apogee: number; // km
  perigee: number; // km
}

export const calculateOrbitalParameters = (line1: string, line2: string): OrbitalData | null => {
  try {
    const satLib = satellite.default || satellite;
    const satrec = satLib.twoline2satrec(line1, line2);
    if (!satrec) return null;

    // Conversions
    // satrec.no is in radians/minute
    // satrec.inclo is in radians
    // satrec.ecco is dimensionless
    
    const MEAN_MOTION_REV_PER_DAY = satrec.no * 1440 / (2 * Math.PI); 
    const INCLINATION_DEG = satrec.inclo * 180 / Math.PI;
    const ECCENTRICITY = satrec.ecco;
    
    // Semi-major axis (a) in km calculation
    // Standard gravitational parameter for Earth (mu) = 398600.4418 km^3/s^2
    // Mean motion (n) must be in rad/s for this formula
    const n_rad_s = satrec.no / 60;
    const mu = 398600.4418;
    const a = Math.pow(mu / (n_rad_s * n_rad_s), 1/3);
    
    // Earth Radius approximation
    const EARTH_RADIUS = 6378.137; // km
    
    const perigee = (a * (1 - ECCENTRICITY)) - EARTH_RADIUS;
    const apogee = (a * (1 + ECCENTRICITY)) - EARTH_RADIUS;
    
    const period = (2 * Math.PI) / n_rad_s / 60; // minutes

    return {
      inclination: INCLINATION_DEG,
      eccentricity: ECCENTRICITY,
      meanMotion: MEAN_MOTION_REV_PER_DAY,
      period,
      apogee,
      perigee
    };
  } catch (e) {
    console.error("Orbital params calculation failed", e);
    return null;
  }
};