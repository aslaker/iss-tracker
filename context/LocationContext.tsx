import React, { createContext, useContext, useState, useEffect } from 'react';
import { LatLng, PassPrediction } from '../types';
import { fetchTLE, predictNextPass } from '../lib/api';
import { useQuery } from '@tanstack/react-query';

interface LocationContextType {
  userLocation: LatLng | null;
  nextPass: PassPrediction | null;
  isPredicting: boolean;
  requestLocation: () => Promise<void>;
  manualLocation: (lat: number, lng: number) => void;
  error: string | null;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [nextPass, setNextPass] = useState<PassPrediction | null>(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: tle } = useQuery({
    queryKey: ['issTLE'],
    queryFn: fetchTLE,
    staleTime: 1000 * 60 * 60,
  });

  // Whenever userLocation or TLE changes, recalculate pass
  useEffect(() => {
    if (userLocation && tle && tle.length === 2) {
      setIsPredicting(true);
      // Small delay to allow UI to show "Calculating" state
      const timeoutId = setTimeout(() => {
        try {
          const pass = predictNextPass(tle[0], tle[1], userLocation);
          setNextPass(pass);
        } catch (e) {
          console.error("Prediction failed:", e);
          // Don't set global error here to avoid blocking other UI, just fail prediction silently
          setNextPass(null);
        } finally {
          setIsPredicting(false);
        }
      }, 500);
      
      return () => clearTimeout(timeoutId);
    }
  }, [userLocation, tle]);

  const requestLocation = async () => {
    setError(null);
    if (!navigator.geolocation) {
      setError("GEOLOCATION_MODULE_MISSING");
      return;
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false, // Low accuracy is faster and sufficient for orbit "overhead" check
          timeout: 10000
        });
      });
      
      setUserLocation({
        lat: position.coords.latitude,
        lng: position.coords.longitude
      });
    } catch (err: any) {
      console.warn("Geolocation failed:", err);
      let errorMessage = "SIGNAL_INTERFERENCE"; // Default generic error
      
      // Handle GeolocationPositionError standard codes
      if (err) {
          if (err.code === 1) errorMessage = "PERMISSION_DENIED";
          else if (err.code === 2) errorMessage = "POSITION_UNAVAILABLE";
          else if (err.code === 3) errorMessage = "TIMEOUT";
          else if (err.message && typeof err.message === 'string') {
              errorMessage = err.message.toUpperCase().replace(/[^A-Z0-9_ ]/g, '_');
          }
      }
      
      setError(errorMessage);
    }
  };

  const manualLocation = (lat: number, lng: number) => {
    setError(null);
    setUserLocation({ lat, lng });
  };

  return (
    <LocationContext.Provider value={{ userLocation, nextPass, isPredicting, requestLocation, manualLocation, error }}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocationContext = () => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocationContext must be used within a LocationProvider');
  }
  return context;
};