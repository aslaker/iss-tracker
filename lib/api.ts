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
// Configurable base URL for Development vs Production
// Production: 'https://ll.thespacedevs.com/2.2.0' (Strict Rate Limits)
// Development: 'https://lldev.thespacedevs.com/2.2.0' (Stale data, lenient limits)
const SPACE_DEVS_BASE_URL = 'https://lldev.thespacedevs.com/2.2.0';

// TLE Sources
const TLE_API_PRIMARY = 'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE';
const TLE_API_BACKUP = 'https://live.ariss.org/iss.txt'; 

// Fallback TLE
const FALLBACK_TLE = [
  "1 25544U 98067A   24140.59865741  .00016717  00000+0  30076-3 0  9995",
  "2 25544  51.6396 235.1195 0005470 216.5982 256.4024 15.49818898442371"
];

// --- MISSION DATABASE (Local Fallback) ---
// Used when Live API is rate-limited, data is missing, or for hardcoded high-quality overrides.
interface MissionProfile {
  start: string;
  end?: string;
  role: string;
  agency?: string;
  image?: string;
}

const MISSION_DB: Record<string, MissionProfile> = {
  // Crew-8
  "Matthew Dominick": { 
    start: "2024-03-04", 
    role: "Commander", 
    agency: "NASA",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/Matthew_Dominick_official_portrait.jpg/480px-Matthew_Dominick_official_portrait.jpg"
  },
  "Michael Barratt": { 
    start: "2024-03-04", 
    role: "Pilot", 
    agency: "NASA",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Michael_Reed_Barratt_v2.jpg/480px-Michael_Reed_Barratt_v2.jpg"
  },
  "Jeanette Epps": { 
    start: "2024-03-04", 
    role: "Mission Specialist", 
    agency: "NASA",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Jeanette_Epps_official_portrait_2016.jpg/480px-Jeanette_Epps_official_portrait_2016.jpg"
  },
  "Alexander Grebenkin": { 
    start: "2024-03-04", 
    role: "Flight Engineer", 
    agency: "Roscosmos",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Alexander_Grebenkin_official_portrait.jpg/480px-Alexander_Grebenkin_official_portrait.jpg"
  },

  // Starliner CFT (Explicit Aliases for reliability)
  "Barry Wilmore": { 
    start: "2024-06-05", 
    role: "Commander", 
    agency: "NASA",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/Barry_Wilmore_official_portrait_2014.jpg/480px-Barry_Wilmore_official_portrait_2014.jpg"
  },
  "Butch Wilmore": { 
    start: "2024-06-05", 
    role: "Commander", 
    agency: "NASA",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/Barry_Wilmore_official_portrait_2014.jpg/480px-Barry_Wilmore_official_portrait_2014.jpg"
  },
  "Sunita Williams": { 
    start: "2024-06-05", 
    role: "Pilot", 
    agency: "NASA",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Sunita_Williams_official_portrait_2018.jpg/480px-Sunita_Williams_official_portrait_2018.jpg"
  },
  "Suni Williams": { 
    start: "2024-06-05", 
    role: "Pilot", 
    agency: "NASA",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Sunita_Williams_official_portrait_2018.jpg/480px-Sunita_Williams_official_portrait_2018.jpg"
  },

  // Soyuz MS-26
  "Donald Pettit": { 
    start: "2024-09-11", 
    role: "Flight Engineer", 
    agency: "NASA",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/Donald_Pettit_official_portrait_2011.jpg/480px-Donald_Pettit_official_portrait_2011.jpg"
  },
  "Don Pettit": { 
    start: "2024-09-11", 
    role: "Flight Engineer", 
    agency: "NASA",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/Donald_Pettit_official_portrait_2011.jpg/480px-Donald_Pettit_official_portrait_2011.jpg"
  },
  "Alexey Ovchinin": { 
    start: "2024-09-11", 
    role: "Commander", 
    agency: "Roscosmos",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Alexey_Ovchinin_official_portrait.jpg/480px-Alexey_Ovchinin_official_portrait.jpg"
  },
  "Ivan Vagner": { 
    start: "2024-09-11", 
    role: "Flight Engineer", 
    agency: "Roscosmos",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/Ivan_Vagner_official_portrait.jpg/480px-Ivan_Vagner_official_portrait.jpg"
  },
  
  // Crew-9
  "Nick Hague": { 
    start: "2024-09-28", 
    role: "Commander", 
    agency: "NASA",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Nick_Hague_official_portrait_2016.jpg/480px-Nick_Hague_official_portrait_2016.jpg"
  },
  "Aleksandr Gorbunov": { 
    start: "2024-09-28", 
    role: "Mission Specialist", 
    agency: "Roscosmos",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Aleksandr_Gorbunov_official_portrait.jpg/480px-Aleksandr_Gorbunov_official_portrait.jpg"
  }
};

// Helper: Strict number validation
const isValidNumber = (n: any): boolean => typeof n === 'number' && !isNaN(n) && isFinite(n);

// Helper: Normalize Longitude to -180 to +180
const normalizeLongitude = (lon: number): number => {
  return ((lon + 180) % 360 + 360) % 360 - 180;
};

// Helper: Fuzzy name matching
const findMissionProfile = (name: string): MissionProfile | undefined => {
  // Remove punctuation and extra spaces, convert to lowercase
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, '').trim();
  const searchName = normalize(name);
  const searchParts = searchName.split(' ');
  const searchLast = searchParts[searchParts.length - 1]; // Use surname for fallback

  const dbKeys = Object.keys(MISSION_DB);

  // 1. Exact Match (Normalized)
  const exactMatch = dbKeys.find(k => normalize(k) === searchName);
  if (exactMatch) return MISSION_DB[exactMatch];

  // 2. Containment Match (e.g. "Don" in "Donald")
  const containmentMatch = dbKeys.find(k => {
    const nKey = normalize(k);
    return nKey.includes(searchName) || searchName.includes(nKey);
  });
  if (containmentMatch) return MISSION_DB[containmentMatch];

  // 3. Last Name Match (Robust Fallback)
  // This catches "Don Pettit" <-> "Donald Pettit"
  const lastNameMatch = dbKeys.find(k => {
    const kParts = normalize(k).split(' ');
    const kLast = kParts[kParts.length - 1];
    return kLast === searchLast;
  });
  if (lastNameMatch) return MISSION_DB[lastNameMatch];

  return undefined;
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
    // 1. Fetch Basic List (Authoritative source for who is currently on board)
    const basicResponse = await fetch(`${PROXY_URL}${encodeURIComponent(CREW_API)}`);
    if (!basicResponse.ok) throw new Error('Basic crew fetch failed');
    const basicData = await basicResponse.json();
    
    // Filter only ISS crew
    const issCrew = (basicData.people || []).filter((p: any) => p.craft === 'ISS');
    
    // 2. Enrich Data using Parallel Search
    const enrichedCrewPromises = issCrew.map(async (basicAstronaut: any) => {
       const name = basicAstronaut.name;
       
       // A. Try Local DB first (Instant, High Reliability for known crew, best images)
       const dbData = findMissionProfile(name);
       
       // B. Try Live API Search (Dynamic, covers new crew not in DB)
       let liveData = null;
       try {
         // Search specifically for this astronaut
         // This bypasses the "limit=50" pagination issue
         const searchUrl = `${SPACE_DEVS_BASE_URL}/astronaut/?search=${encodeURIComponent(name)}`;
         const response = await fetch(searchUrl);
         if (response.ok) {
            const json = await response.json();
            // The search is powerful; usually the first result is the correct person
            if (json.results && json.results.length > 0) {
               liveData = json.results[0];
            }
         }
       } catch (e) {
         console.warn(`Live fetch failed for ${name}`, e);
       }

       // --- MERGE STRATEGY ---
       // 1. Start with Basic Open Notify Data
       // 2. Enhance with Live API if available
       // 3. Fallback/Override with Local DB for critical missing pieces

       // IMAGE PRIORITY: Live API > Local DB > Placeholder
       // User Request: "Merge image... enhance what we have". 
       // We prefer the Live API image if it exists (restoring the "images we had before"),
       // but fallback to DB if the API fails or has no image.
       const image = liveData?.profile_image || liveData?.profile_image_thumbnail || dbData?.image;

       // DATE PRIORITY: Local DB > Live API
       // User Request: "The data [launch dates] is back [with DB]".
       // Live API dates are often missing for active missions or require complex parsing.
       // DB dates are manually curated and reliable.
       let launchDate = dbData?.start;
       
       // If DB date is missing, try to extract from Live Data
       if (!launchDate && liveData) {
         const flights = (liveData.flights || []).sort((a: any, b: any) => 
             new Date(b.window_start || 0).getTime() - new Date(a.window_start || 0).getTime()
         );
         launchDate = flights[0]?.window_start;
       }

       // ROLE/AGENCY PRIORITY: Live API > Local DB
       // Live API usually has accurate current roles/agencies.
       const role = liveData?.type?.name || dbData?.role || "Astronaut";
       const agency = liveData?.agency?.name || dbData?.agency;
       const bio = liveData?.bio || "No biography available via secure uplink.";

       return {
         ...basicAstronaut,
         image,
         role,
         agency,
         bio,
         launchDate,
         endDate: dbData?.end
       };
    });

    const mergedCrew = await Promise.all(enrichedCrewPromises);

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
        endDate: MISSION_DB[name].end,
        image: MISSION_DB[name].image
    }));

    // Dedup fallback list based on image
    const uniqueFallbackList = fallbackList.filter((item, index, self) =>
        index === self.findIndex((t) => (
            t.image === item.image
        ))
    );

    return {
        message: "cached_fallback",
        number: uniqueFallbackList.length,
        people: uniqueFallbackList
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