import { ISSPosition, CrewData, Astronaut, PassPrediction, LatLng } from '../types';
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

// Fallback TLE
const FALLBACK_TLE = [
  "1 25544U 98067A   24140.59865741  .00016717  00000+0  30076-3 0  9995",
  "2 25544  51.6396 235.1195 0005470 216.5982 256.4024 15.49818898442371"
];

// --- MISSION DATABASE (Local Lookup) ---
interface MissionProfile {
  start?: string; 
  end?: string;
  role: string;
  agency?: string;
  image?: string;
  aliasFor?: string; 
}

const MISSION_DB: Record<string, MissionProfile> = {
  // Starliner (Extended Stay)
  "Sunita Williams": { 
    start: "2024-06-05", 
    role: "Commander", 
    agency: "NASA", 
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Sunita_Williams_official_portrait_2018.jpg/480px-Sunita_Williams_official_portrait_2018.jpg"
  },
  "Suni Williams": { aliasFor: "Sunita Williams", role: "", agency: "" },
  "Barry Wilmore": { 
    start: "2024-06-05", 
    role: "Pilot", 
    agency: "NASA", 
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/Barry_Wilmore_official_portrait_2014.jpg/480px-Barry_Wilmore_official_portrait_2014.jpg"
  },
  "Butch Wilmore": { aliasFor: "Barry Wilmore", role: "", agency: "" },

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
  },

  // Soyuz MS-26
  "Donald Pettit": { 
    start: "2024-09-11", 
    role: "Flight Engineer", 
    agency: "NASA", 
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/Donald_Pettit_official_portrait_2011.jpg/480px-Donald_Pettit_official_portrait_2011.jpg"
  },
  "Don Pettit": { aliasFor: "Donald Pettit", role: "", agency: "" },
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

  // Soyuz MS-25
  "Oleg Kononenko": { 
    start: "2023-09-15",
    role: "Commander", 
    agency: "Roscosmos", 
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Oleg_Kononenko_official_portrait_2011.jpg/480px-Oleg_Kononenko_official_portrait_2011.jpg" 
  },
  "Nikolai Chub": { 
    start: "2023-09-15",
    role: "Flight Engineer", 
    agency: "Roscosmos", 
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Nikolai_Chub_official_portrait.jpg/480px-Nikolai_Chub_official_portrait.jpg" 
  },
  "Tracy Caldwell Dyson": { 
    start: "2024-03-23",
    role: "Flight Engineer", 
    agency: "NASA", 
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Tracy_Caldwell_Dyson_official_portrait_2010.jpg/480px-Tracy_Caldwell_Dyson_official_portrait_2010.jpg" 
  },
  "Tracy Dyson": { aliasFor: "Tracy Caldwell Dyson", role: "", agency: "" },

  // Crew-8
  "Matthew Dominick": { start: "2024-03-04", role: "Commander", agency: "NASA", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/Matthew_Dominick_official_portrait.jpg/480px-Matthew_Dominick_official_portrait.jpg" },
  "Michael Barratt": { start: "2024-03-04", role: "Pilot", agency: "NASA", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Michael_Reed_Barratt_v2.jpg/480px-Michael_Reed_Barratt_v2.jpg" },
  "Jeanette Epps": { start: "2024-03-04", role: "Mission Specialist", agency: "NASA", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Jeanette_Epps_official_portrait_2016.jpg/480px-Jeanette_Epps_official_portrait_2016.jpg" },
  "Alexander Grebenkin": { start: "2024-03-04", role: "Flight Engineer", agency: "Roscosmos", image: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Alexander_Grebenkin_official_portrait.jpg/480px-Alexander_Grebenkin_official_portrait.jpg" },
};

const isValidNumber = (n: any): boolean => typeof n === 'number' && !isNaN(n) && isFinite(n);
const normalizeLongitude = (lon: number): number => ((lon + 180) % 360 + 360) % 360 - 180;

// Helper: Get Satellite Library safely
const getSatelliteLib = () => {
    // Handle various import scenarios for satellite.js (ESM/CommonJS/Bundled)
    const lib = (satellite as any).default || satellite;
    if (!lib || !lib.twoline2satrec) {
        console.warn("Satellite.js library not loaded correctly", lib);
        throw new Error("ORBITAL_LIB_ERROR");
    }
    return lib;
};

// Helper: Find profile in DB
const findMissionProfile = (name: string): MissionProfile | undefined => {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, '').trim();
  const searchName = normalize(name);

  const dbKeys = Object.keys(MISSION_DB);
  
  // 1. Exact Match
  const exactKey = dbKeys.find(k => normalize(k) === searchName);
  if (exactKey) {
    const entry = MISSION_DB[exactKey];
    return entry.aliasFor && MISSION_DB[entry.aliasFor] ? MISSION_DB[entry.aliasFor] : entry;
  }

  // 2. Fuzzy Last Name Match (Simple Fallback)
  const searchParts = searchName.split(' ');
  const searchLast = searchParts[searchParts.length - 1];

  const fallbackKey = dbKeys.find(k => {
    const nKey = normalize(k);
    return nKey.includes(searchLast) && (nKey.includes(searchName) || searchName.includes(nKey));
  });

  if (fallbackKey) {
     const entry = MISSION_DB[fallbackKey];
     return entry.aliasFor && MISSION_DB[entry.aliasFor] ? MISSION_DB[entry.aliasFor] : entry;
  }

  return undefined;
};

export const fetchISSPosition = async (): Promise<ISSPosition> => {
  try {
    const response = await fetch(WTIA_API);
    if (!response.ok) throw new Error(`WTIA API Error: ${response.status}`);
    const data = await response.json();
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
      return {
        latitude: parseFloat(data.iss_position.latitude),
        longitude: parseFloat(data.iss_position.longitude),
        timestamp: data.timestamp,
        altitude: 417.5,
        velocity: 27600,
        visibility: 'orbiting'
      };
    } catch (fallbackError) {
      throw fallbackError;
    }
  }
};

export const fetchCrewData = async (): Promise<CrewData> => {
  try {
    const basicResponse = await fetch(`${PROXY_URL}${encodeURIComponent(CREW_API)}`);
    if (!basicResponse.ok) throw new Error('Basic crew fetch failed');
    const basicData = await basicResponse.json();
    
    const issCrew = (basicData.people || []).filter((p: any) => p.craft === 'ISS');
    
    const enrichedCrew = issCrew.map((basicAstronaut: any) => {
       const dbData = findMissionProfile(basicAstronaut.name);

       return {
         ...basicAstronaut,
         image: dbData?.image,
         role: dbData?.role || "Astronaut",
         agency: dbData?.agency || "Unknown",
         launchDate: dbData?.start,
         endDate: dbData?.end
       };
    });

    return {
      message: "success",
      number: enrichedCrew.length,
      people: enrichedCrew
    };

  } catch (e) {
    console.warn("Crew data fetch failed.");
    return {
        message: "error",
        number: 0,
        people: []
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

export const calculateOrbitPath = (line1: string, line2: string, startMins: number, endMins: number, stepMins: number = 1) => {
  const points = [];
  try {
    const satLib = getSatelliteLib();
    const satrec = satLib.twoline2satrec(line1, line2);
    if (!satrec) return [];
    const now = new Date();
    for (let i = startMins; i <= endMins; i += stepMins) {
      const time = new Date(now.getTime() + i * 60 * 1000);
      const pos = satLib.propagate(satrec, time).position;
      if (pos && typeof pos !== 'boolean') {
        const gmst = satLib.gstime(time);
        const geo = satLib.eciToGeodetic(pos, gmst);
        points.push({
            lat: satLib.degreesLat(geo.latitude),
            lng: normalizeLongitude(satLib.degreesLong(geo.longitude)),
            alt: geo.height
        });
      }
    }
  } catch (e) {}
  return points;
};

export const predictOrbit = (l1: string, l2: string, duration: number) => calculateOrbitPath(l1, l2, 0, duration);

export const formatCoordinate = (val: number, type: 'lat' | 'lon'): string => {
  if (!isValidNumber(val)) return "0.0000°";
  const dir = type === 'lat' ? (val > 0 ? 'N' : 'S') : (val > 0 ? 'E' : 'W');
  return `${Math.abs(val).toFixed(4)}° ${dir}`;
};

export const calculateOrbitalParameters = (line1: string, line2: string) => {
  try {
    const satLib = getSatelliteLib();
    const satrec = satLib.twoline2satrec(line1, line2);
    if (!satrec) return null;
    const n_rad_s = satrec.no / 60;
    const mu = 398600.4418;
    const a = Math.pow(mu / (n_rad_s * n_rad_s), 1/3);
    return {
      inclination: satrec.inclo * 180 / Math.PI,
      eccentricity: satrec.ecco,
      meanMotion: satrec.no * 1440 / (2 * Math.PI),
      period: (2 * Math.PI) / n_rad_s / 60,
      apogee: (a * (1 + satrec.ecco)) - 6378.137,
      perigee: (a * (1 - satrec.ecco)) - 6378.137
    };
  } catch (e) {
    return null;
  }
};

export const predictNextPass = (line1: string, line2: string, userLoc: LatLng): PassPrediction | null => {
  try {
    const satLib = getSatelliteLib();
    const satrec = satLib.twoline2satrec(line1, line2);
    
    // Observer
    const observerGd = {
      latitude: satLib.degreesToRadians(userLoc.lat),
      longitude: satLib.degreesToRadians(userLoc.lng),
      height: 0.03 
    };

    const now = new Date();
    const stepSeconds = 20; 
    const maxHorizon = 24 * 60 * 60 * 1000; 
    let t = 0;
    
    let passStart: Date | null = null;
    let maxEl = 0;
    let passPath: { lat: number; lng: number; alt: number }[] = [];

    while (t < maxHorizon) {
      const time = new Date(now.getTime() + t);
      
      const posEci = satLib.propagate(satrec, time).position;
      const gmst = satLib.gstime(time);
      
      if (!posEci || typeof posEci === 'boolean') {
          t += stepSeconds * 1000;
          continue;
      }

      const posEcf = satLib.eciToEcf(posEci, gmst);
      const look = satLib.ecfToLookAngles(observerGd, posEcf);
      
      const elevationDeg = satLib.radiansToDegrees(look.elevation);

      if (elevationDeg > 10) {
        if (!passStart) {
          passStart = time;
          passPath = [];
        }
        
        if (elevationDeg > maxEl) maxEl = elevationDeg;

        const geo = satLib.eciToGeodetic(posEci, gmst);
        passPath.push({
            lat: satLib.degreesLat(geo.latitude),
            lng: normalizeLongitude(satLib.degreesLong(geo.longitude)),
            alt: geo.height
        });

      } else if (passStart) {
        return {
          startTime: passStart,
          endTime: time,
          duration: (time.getTime() - passStart.getTime()) / 1000 / 60,
          maxElevation: maxEl,
          path: passPath
        };
      }
      
      t += stepSeconds * 1000;
    }
    
    return null; 
  } catch (e) {
    console.error("Pass prediction error", e);
    return null;
  }
};