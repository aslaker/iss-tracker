import { ISSPosition, CrewData, Astronaut } from '../types';
// @ts-ignore
import * as satellite from 'satellite.js';

// APIs
// Primary: HTTPS, CORS-enabled, Rich Data
const WTIA_API = 'https://api.wheretheiss.at/v1/satellites/25544';
// Fallback: HTTP-only (requires proxy)
const POSITION_API_LEGACY = 'http://api.open-notify.org/iss-now.json';
const CREW_API = 'http://api.open-notify.org/astros.json';
const PROXY_URL = 'https://api.allorigins.win/raw?url=';

// The Space Devs API (Launch Library 2)
const LL2_API_ASTRONAUTS = 'https://ll.thespacedevs.com/2.2.0/astronaut/?status=1&limit=50';

// TLE Sources
const TLE_API_PRIMARY = 'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE';
const TLE_API_BACKUP = 'https://live.ariss.org/iss.txt'; 

// Fallback TLE
const FALLBACK_TLE = [
  "1 25544U 98067A   24140.59865741  .00016717  00000+0  30076-3 0  9995",
  "2 25544  51.6396 235.1195 0005470 216.5982 256.4024 15.49818898442371"
];

// --- MISSION DATABASE (Local Fallback) ---
// Used when Live API is rate-limited or data is missing.
interface MissionProfile {
  start: string;
  end?: string;
  role: string;
  agency?: string;
}

const MISSION_DB: Record<string, MissionProfile> = {
  // Crew-8
  "Matthew Dominick": { start: "2024-03-04", role: "Commander", agency: "NASA" },
  "Michael Barratt": { start: "2024-03-04", role: "Pilot", agency: "NASA" },
  "Jeanette Epps": { start: "2024-03-04", role: "Mission Specialist", agency: "NASA" },
  "Alexander Grebenkin": { start: "2024-03-04", role: "Flight Engineer", agency: "Roscosmos" },

  // Soyuz MS-25
  "Tracy Caldwell Dyson": { start: "2024-03-23", end: "2024-09-23", role: "Flight Engineer", agency: "NASA" },
  "Oleg Kononenko": { start: "2023-09-15", end: "2024-09-23", role: "Commander", agency: "Roscosmos" },
  "Nikolai Chub": { start: "2023-09-15", end: "2024-09-23", role: "Flight Engineer", agency: "Roscosmos" },

  // Starliner CFT (Extended Stay)
  "Barry Wilmore": { start: "2024-06-05", role: "Commander", agency: "NASA" },
  "Sunita Williams": { start: "2024-06-05", role: "Pilot", agency: "NASA" },

  // Soyuz MS-26
  "Donald Pettit": { start: "2024-09-11", role: "Flight Engineer", agency: "NASA" },
  "Alexey Ovchinin": { start: "2024-09-11", role: "Commander", agency: "Roscosmos" },
  "Ivan Vagner": { start: "2024-09-11", role: "Flight Engineer", agency: "Roscosmos" },
  
  // Crew-9
  "Nick Hague": { start: "2024-09-28", role: "Commander", agency: "NASA" },
  "Aleksandr Gorbunov": { start: "2024-09-28", role: "Mission Specialist", agency: "Roscosmos" }
};

// Helper: Strict number validation
const isValidNumber = (n: any): boolean => typeof n === 'number' && !isNaN(n) && isFinite(n);

// Helper: Normalize Longitude to -180 to +180
const normalizeLongitude = (lon: number): number => {
  return ((lon + 180) % 360 + 360) % 360 - 180;
};

export const fetchISSPosition = async (): Promise<ISSPosition> => {
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
      altitude: data.altitude,
      velocity: data.velocity,
      visibility: data.visibility
    };
  } catch (primaryError) {
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
        altitude: 417.5,
        velocity: 27600,
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
    // 1. Fetch Basic List (Authoritative)
    const basicResponse = await fetch(`${PROXY_URL}${encodeURIComponent(CREW_API)}`);
    if (!basicResponse.ok) throw new Error('Basic crew fetch failed');
    const basicData = await basicResponse.json();
    
    // Filter only ISS crew
    const issCrew = (basicData.people || []).filter((p: any) => p.craft === 'ISS');
    let richAstronauts: any[] = [];

    // 2. Try to fetch Rich Data (SpaceDevs)
    try {
      const richResponse = await fetch(LL2_API_ASTRONAUTS);
      if (richResponse.ok) {
        const richData = await richResponse.json();
        richAstronauts = richData.results || [];
      }
    } catch (enrichmentError) {
      console.warn("LL2 Enrichment skipped/failed (using DB fallback)", enrichmentError);
    }

    // 3. Merge Strategy: Basic -> Local DB -> Live API
    const mergedCrew = issCrew.map((basicAstronaut: any) => {
      // Step A: Look up in Local DB
      const dbData = MISSION_DB[basicAstronaut.name];

      // Step B: Look up in Live API
      const liveData = richAstronauts.find((ra: any) => 
        ra.name.toLowerCase().includes(basicAstronaut.name.toLowerCase()) || 
        basicAstronaut.name.toLowerCase().includes(ra.name.toLowerCase())
      );

      // Extract Launch Date: Live API > DB > Undefined
      let launchDate = undefined;
      if (liveData) {
        // Sort flights to find the active one
        const flights = (liveData.flights || []).sort((a: any, b: any) => 
            new Date(b.window_start || 0).getTime() - new Date(a.window_start || 0).getTime()
        );
        launchDate = flights[0]?.window_start;
      }
      // Fallback to DB if live data missing or no launch date found
      if (!launchDate && dbData) {
        launchDate = dbData.start;
      }

      return {
        ...basicAstronaut,
        // Live image > None (DB doesn't store images to save space)
        image: liveData?.profile_image_thumbnail || liveData?.profile_image,
        // Live role > DB role > Default
        role: liveData?.type?.name || dbData?.role || "Astronaut",
        // Live agency > DB agency
        agency: liveData?.agency?.name || dbData?.agency,
        bio: liveData?.bio,
        launchDate: launchDate,
        endDate: dbData?.end // Prefer DB for end dates as API often omits them for active missions
      };
    });

    return {
      message: "success",
      number: mergedCrew.length,
      people: mergedCrew
    };

  } catch (e) {
    console.warn("Crew data fetch completely failed, using cached manifest.");
    // Emergency Fallback if OpenNotify fails completely
    const fallbackList = Object.keys(MISSION_DB).map(name => ({
        name,
        craft: 'ISS',
        ...MISSION_DB[name],
        launchDate: MISSION_DB[name].start,
        endDate: MISSION_DB[name].end
    }));

    return {
        message: "cached_fallback",
        number: fallbackList.length,
        people: fallbackList
    };
  }
};

const fetchTLEFromUrl = async (url: string): Promise<[string, string]> => {
  try {
    const response = await fetch(url);
    if (response.ok) {
      const text = await response.text();
      return parseTLELines(text);
    }
  } catch(e) { /* ignore */ }

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

  if (line1 && line2) return [line1.trim(), line2.trim()];
  throw new Error('Invalid TLE format');
}

export const fetchTLE = async (): Promise<[string, string]> => {
  try {
    return await fetchTLEFromUrl(TLE_API_PRIMARY);
  } catch (e) {
    try {
      return await fetchTLEFromUrl(TLE_API_BACKUP);
    } catch (backupError) {
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
    const satLib = (satellite as any).default || satellite;
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

export const predictOrbit = (l1: string, l2: string, duration: number) => calculateOrbitPath(l1, l2, 0, duration);

export const formatCoordinate = (val: number, type: 'lat' | 'lon'): string => {
  if (!isValidNumber(val)) return "0.0000°";
  const dir = type === 'lat'
    ? (val > 0 ? 'N' : 'S')
    : (val > 0 ? 'E' : 'W');
  return `${Math.abs(val).toFixed(4)}° ${dir}`;
};

export interface OrbitalData {
  inclination: number;
  eccentricity: number;
  meanMotion: number;
  period: number;
  apogee: number;
  perigee: number;
}

export const calculateOrbitalParameters = (line1: string, line2: string): OrbitalData | null => {
  try {
    const satLib = (satellite as any).default || satellite;
    const satrec = satLib.twoline2satrec(line1, line2);
    if (!satrec) return null;

    const MEAN_MOTION_REV_PER_DAY = satrec.no * 1440 / (2 * Math.PI); 
    const INCLINATION_DEG = satrec.inclo * 180 / Math.PI;
    const ECCENTRICITY = satrec.ecco;
    
    const n_rad_s = satrec.no / 60;
    const mu = 398600.4418;
    const a = Math.pow(mu / (n_rad_s * n_rad_s), 1/3);
    const EARTH_RADIUS = 6378.137;
    
    const perigee = (a * (1 - ECCENTRICITY)) - EARTH_RADIUS;
    const apogee = (a * (1 + ECCENTRICITY)) - EARTH_RADIUS;
    const period = (2 * Math.PI) / n_rad_s / 60;

    return {
      inclination: INCLINATION_DEG,
      eccentricity: ECCENTRICITY,
      meanMotion: MEAN_MOTION_REV_PER_DAY,
      period,
      apogee,
      perigee
    };
  } catch (e) {
    return null;
  }
};