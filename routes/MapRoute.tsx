import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchISSPosition, fetchTLE, calculateOrbitPath } from '../lib/api';
import { StatsPanel } from '../components/StatsPanel';

const MAP_IMAGE_URL = "https://upload.wikimedia.org/wikipedia/commons/e/ec/World_map_blank_without_borders.svg";

export const MapView: React.FC = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['issPosition'],
    queryFn: fetchISSPosition,
    refetchInterval: 5000,
  });

  const { data: tleData } = useQuery({
    queryKey: ['issTLE'],
    queryFn: fetchTLE,
    staleTime: 1000 * 60 * 60,
  });

  const [mapError, setMapError] = useState(false);

  // Robust Coordinate Helper
  const getXY = (lat: number | undefined, lon: number | undefined) => {
    // Strict checks for undefined or NaN
    if (lat === undefined || lon === undefined || typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) {
        return { x: -999, y: -999 };
    }
    const x = ((lon + 180) / 360) * 100;
    const y = ((90 - lat) / 180) * 100;
    return { x, y };
  };

  const createSafePathSegments = (points: {lat: number, lng: number}[]) => {
    if (!points || !Array.isArray(points) || points.length < 2) return [];
    
    const segments: string[] = [];
    let currentSegmentPoints: {x: number, y: number}[] = [];

    for (let i = 0; i < points.length; i++) {
      const curr = points[i];
      if (!curr) continue;

      const prev = i > 0 ? points[i-1] : null;

      // Anti-meridian crossing check
      if (prev && Math.abs(curr.lng - prev.lng) > 180) {
        if (currentSegmentPoints.length > 1) {
          segments.push(currentSegmentPoints.map(p => `${p.x},${p.y}`).join(' '));
        }
        currentSegmentPoints = [];
      }

      const point = getXY(curr.lat, curr.lng);
      
      // Only add point if it's valid (on screen)
      if (point.x !== -999 && point.y !== -999) {
          currentSegmentPoints.push(point);
      }
    }

    if (currentSegmentPoints.length > 1) {
      segments.push(currentSegmentPoints.map(p => `${p.x},${p.y}`).join(' '));
    }
    return segments;
  };

  const { historySegments, predictedSegments } = useMemo(() => {
    if (!tleData) return { historySegments: [], predictedSegments: [] };

    const histPoints = calculateOrbitPath(tleData[0], tleData[1], -45, 0);
    const histSegments = createSafePathSegments(histPoints);

    const predPoints = calculateOrbitPath(tleData[0], tleData[1], 0, 90);
    const predSegments = createSafePathSegments(predPoints);

    return { historySegments: histSegments, predictedSegments: predSegments };
  }, [tleData]);

  // Safe current position
  const currentPos = useMemo(() => {
    if (data && typeof data.latitude === 'number' && typeof data.longitude === 'number' && !isNaN(data.latitude)) {
        return getXY(data.latitude, data.longitude);
    }
    return null;
  }, [data]);

  return (
    <div className="flex flex-col md:flex-row h-full w-full">
      <div className="flex-1 bg-matrix-bg relative overflow-hidden border-r border-matrix-dim flex items-center justify-center p-4">

        <div className="absolute inset-0 z-0 pointer-events-none" style={{
            backgroundImage: 'linear-gradient(rgba(0, 255, 65, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 65, 0.05) 1px, transparent 1px)',
            backgroundSize: '40px 40px'
        }}></div>

        <div className="relative w-full max-w-6xl aspect-[2/1] border border-matrix-dim bg-[#050505] shadow-[0_0_20px_rgba(0,255,65,0.1)] overflow-hidden">
          
          {!mapError ? (
            <img 
              src={MAP_IMAGE_URL} 
              alt="World Map" 
              onError={() => setMapError(true)}
              // Changed object-cover to w-full h-full to force perfect alignment with the 2:1 coordinate system
              className="absolute inset-0 w-full h-full select-none pointer-events-none"
              style={{ 
                filter: 'sepia(1) saturate(5) hue-rotate(70deg) brightness(0.6) contrast(1.2)',
                opacity: 0.4
              }}
            />
          ) : (
             <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-matrix-dim text-xs font-mono border border-matrix-dim p-4">
                  [!] MAP_DATA_OFFLINE // RENDERING GRID_ONLY
                </div>
             </div>
          )}

          <svg 
            className="absolute inset-0 w-full h-full z-10" 
            viewBox="0 0 100 100" 
            preserveAspectRatio="none"
          >
            {predictedSegments.map((points, i) => (
              <polyline
                key={`pred-${i}`}
                points={points}
                fill="none"
                stroke="#00FF41"
                strokeWidth="0.3" 
                strokeDasharray="1 1"
                className="opacity-50"
              />
            ))}

            {historySegments.map((points, i) => (
              <polyline
                key={`hist-${i}`}
                points={points}
                fill="none"
                stroke="#00FF41"
                strokeWidth="0.5" 
                className="opacity-90"
              />
            ))}

            {currentPos && currentPos.x !== -999 && (
              <g transform={`translate(${currentPos.x}, ${currentPos.y})`}>
                <circle r="1.5" fill="none" stroke="#00FF41" strokeWidth="0.1" className="opacity-0">
                  <animate attributeName="r" from="0.5" to="4" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="1" to="0" dur="2s" repeatCount="indefinite" />
                </circle>
                <circle r="0.8" fill="#00FF41" className="drop-shadow-[0_0_4px_#00FF41]" />
                <line x1="-3" y1="0" x2="3" y2="0" stroke="#00FF41" strokeWidth="0.1" opacity="0.6" />
                <line x1="0" y1="-3" x2="0" y2="3" stroke="#00FF41" strokeWidth="0.1" opacity="0.6" />
                <text x="1.5" y="-1.5" fontSize="2" fill="#00FF41" fontFamily="monospace" fontWeight="bold">ISS</text>
              </g>
            )}
          </svg>
          
          {data && (
            <div className="absolute top-2 right-2 font-mono text-[10px] text-matrix-text bg-black/80 p-1 border border-matrix-dim z-20">
              POS: {data.latitude?.toFixed(2)}, {data.longitude?.toFixed(2)}
            </div>
          )}

          {predictedSegments.length > 0 && (
             <div className="absolute bottom-2 left-2 font-mono text-[8px] text-matrix-dim/70 z-20">
                -- -- PREDICTED PATH
             </div>
          )}
        </div>
        
        {/* Decorations */}
        <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-matrix-dim"></div>
        <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-matrix-dim"></div>
        <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-matrix-dim"></div>
        <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-matrix-dim"></div>
      </div>

      <div className="w-full md:w-80 flex-none h-[40vh] md:h-auto border-t md:border-t-0 border-matrix-dim">
        <StatsPanel data={data} isLoading={isLoading} />
      </div>
    </div>
  );
};