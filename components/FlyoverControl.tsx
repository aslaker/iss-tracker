import React, { useState, useEffect } from 'react';
import { Target, MapPin, AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import { useLocationContext } from '../context/LocationContext';
import { MatrixText } from './MatrixText';
import { terminalAudio } from '../lib/audio';

export const FlyoverControl: React.FC = () => {
  const { userLocation, nextPass, isPredicting, requestLocation, error } = useLocationContext();
  const [timeLeft, setTimeLeft] = useState<string>("--:--:--");

  // Countdown Timer Logic
  useEffect(() => {
    if (!nextPass) return;

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const start = nextPass.startTime.getTime();
      const diff = start - now;

      if (diff <= 0) {
        // Pass is happening NOW
        const end = nextPass.endTime.getTime();
        if (now < end) {
            setTimeLeft("FLYOVER_IN_PROGRESS");
        } else {
            setTimeLeft("PASSED");
        }
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [nextPass]);

  // Helper to safely render error message
  const renderError = () => {
      if (!error) return null;
      if (typeof error === 'string') return error;
      // Fallback if error is an object
      return "ERROR_UNKNOWN // OBJ_DETECTED";
  };

  return (
    <div className="absolute bottom-4 left-4 z-30">
        <div className="bg-black/90 border border-matrix-dim p-3 w-64 backdrop-blur-sm shadow-[0_0_15px_rgba(0,143,17,0.3)]">
            <div className="flex items-center justify-between mb-2 border-b border-matrix-dim/50 pb-1">
                <div className="flex items-center gap-2 text-matrix-text">
                    <Target className="w-4 h-4 animate-pulse" />
                    <span className="text-xs font-bold tracking-wider uppercase">Flyover_Alert</span>
                </div>
                {userLocation && (
                     <button 
                        onClick={() => {
                            terminalAudio.playClick();
                            requestLocation();
                        }}
                        className="text-matrix-dim hover:text-matrix-text"
                        title="Refresh Location"
                     >
                         <RefreshCw className="w-3 h-3" />
                     </button>
                )}
            </div>

            {!userLocation ? (
                <div className="text-center py-2">
                    <p className="text-[10px] text-matrix-dim mb-2 uppercase">Sync Coordinates for Prediction</p>
                    <button 
                        onClick={() => {
                            terminalAudio.playClick();
                            requestLocation();
                        }}
                        className="w-full border border-matrix-text text-matrix-text hover:bg-matrix-text hover:text-black text-xs py-1 transition-colors uppercase font-bold flex items-center justify-center gap-2"
                    >
                        <MapPin className="w-3 h-3" />
                        Acquire Location
                    </button>
                    {error && (
                        <div className="text-[9px] text-red-500 mt-2 flex items-center gap-1 justify-center">
                            <AlertTriangle className="w-3 h-3" />
                            <span>{renderError()}</span>
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-2">
                    <div className="flex justify-between items-end text-[10px] text-matrix-dim font-mono">
                        <span>LAT: {userLocation.lat.toFixed(2)}</span>
                        <span>LNG: {userLocation.lng.toFixed(2)}</span>
                    </div>

                    {isPredicting ? (
                        <div className="text-center py-2 text-xs text-matrix-dim animate-pulse">
                            CALCULATING_TRAJECTORY...
                        </div>
                    ) : nextPass ? (
                        <>
                            <div className="bg-matrix-dim/10 border border-matrix-dim/30 p-2 text-center">
                                <div className="text-[9px] text-matrix-dim uppercase mb-1">Time to Acquisition</div>
                                <div className="text-xl font-bold text-yellow-400 font-mono tracking-widest">
                                    {timeLeft}
                                </div>
                            </div>
                            <div className="flex justify-between text-[9px] text-matrix-dim uppercase">
                                <span>Dur: {Math.round(nextPass.duration)}m</span>
                                <span>Max El: {Math.round(nextPass.maxElevation)}°</span>
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-2 text-[10px] text-matrix-dim">
                            NO VISIBLE PASS DETECTED<br/>IN NEXT 24 HOURS
                        </div>
                    )}
                </div>
            )}
        </div>
    </div>
  );
};