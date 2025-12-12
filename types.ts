export interface OpenNotifyPositionResponse {
  message: string;
  timestamp: number;
  iss_position: {
    latitude: string;
    longitude: string;
  };
}

export interface ISSPosition {
  latitude: number;
  longitude: number;
  timestamp: number;
  // Enriched fields for UI (Calculated or Constants since OpenNotify doesn't provide them)
  altitude: number;
  velocity: number;
  visibility: string;
}

export interface Astronaut {
  name: string;
  craft: string;
}

export interface CrewData {
  message: string;
  number: number;
  people: Astronaut[];
}

export interface GeoLocation {
  country?: string;
  region?: string;
  isOverWater: boolean;
}