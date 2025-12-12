import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchISSPosition, fetchTLE, predictOrbit } from '../lib/api';
import { StatsPanel } from '../components/StatsPanel';

// Reliable solid-fill map image (Equirectangular projection)
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

  const [positionHistory, setPositionHistory] = useState<{lat: number, lon: number}[]>([]);
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    if (data && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
      setPositionHistory(prev => {
        const newPoint = { lat: data.latitude, lon: data.longitude };
        const newHist = [...prev, newPoint];
        // Keep history manageable
        if (newHist.length > 300) return newHist.slice(newHist.length - 300);
        return newHist;
      });
    }
  }, [data]);

  // Coordinate helper: Equirectangular projection
  // Maps Lat/Lon to 0-100% relative coordinates
  const getXY = (lat: number, lon: number) => {
    if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) {
        return { x: 0, y: 0 };
    }
    const x = ((lon + 180) / 360) * 100;
    const y = ((90 - lat) / 180) * 100;
    return { x, y };
  };

  // Helper to split paths when they cross the anti-meridian (Date Line)
  const createSafePathSegments = (points: {lat: number, lon: number}[]) => {
    if (!points || points.length < 2) return [];
    
    const segments: string[] = [];
    let currentSegmentPoints: {x: number, y: number}[] = [];

    for (let i = 0; i < points.length; i++) {
      const curr = points[i];
      if (!curr) continue;

      const prev = i > 0 ? points[i-1] : null;

      // Check for date line crossing (jump > 180 degrees longitude)
      if (prev && Math.abs(curr.lon - prev.lon) > 180) {
        // Push current segment if valid
        if (currentSegmentPoints.length > 1) {
          segments.push(currentSegmentPoints.map(p => `${p.x},${p.y}`).join(' '));
        }
        // Start new segment
        currentSegmentPoints = [];
      }

      const point = getXY(curr.lat, curr.lon);
      currentSegmentPoints.push(point);
    }

    // Push final segment
    if (currentSegmentPoints.length > 1) {
      segments.push(currentSegmentPoints.map(p => `${p.x},${p.y}`).join(' '));
    }
    return segments;
  };

  // Historical Trajectory
  const historySegments = useMemo(() => {
    return createSafePathSegments(positionHistory);
  }, [positionHistory]);

  // Predicted Trajectory
  const predictedSegments = useMemo(() => {
    if (!tleData) return [];
    const points = predictOrbit(tleData[0], tleData[1], 90); // 90 mins prediction
    const mapPoints = points.map(p => ({ lat: p.lat, lon: p.lng }));
    return createSafePathSegments(mapPoints);
  }, [tleData]);

  const currentPos = data && typeof data.latitude === 'number' ? getXY(data.latitude, data.longitude) : null;

  return (
    <div className="flex flex-col md:flex-row h-full w-full">
      <div className="flex-1 bg-matrix-bg relative overflow-hidden border-r border-matrix-dim flex items-center justify-center p-4">

        {/* Grid Background Effect */}
        <div className="absolute inset-0 z-0 pointer-events-none" style={{
            backgroundImage: 'linear-gradient(rgba(0, 255, 65, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 65, 0.05) 1px, transparent 1px)',
            backgroundSize: '40px 40px'
        }}></div>

        {/* Map Container - Fixed Aspect Ratio 2:1 */}
        <div className="relative w-full max-w-6xl aspect-[2/1] border border-matrix-dim bg-[#050505] shadow-[0_0_20px_rgba(0,255,65,0.1)] overflow-hidden">
          
          {/* World Map Image */}
          {!mapError ? (
            <img 
              src={MAP_IMAGE_URL} 
              alt="World Map" 
              onError={() => setMapError(true)}
              className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
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

          {/* SVG Overlay for Dynamic Elements */}
          <svg 
            className="absolute inset-0 w-full h-full z-10" 
            viewBox="0 0 100 100" 
            preserveAspectRatio="none"
          >
            {/* Predicted Trajectory (Faint/Dashed) */}
            {predictedSegments.map((points, i) => (
              <polyline
                key={`pred-${i}`}
                points={points}
                fill="none"
                stroke="#00FF41"
                strokeWidth="0.1"
                strokeDasharray="1 1"
                className="opacity-40"
              />
            ))}

            {/* Historical Trajectory (Bright/Solid-ish) */}
            {historySegments.map((points, i) => (
              <polyline
                key={`hist-${i}`}
                points={points}
                fill="none"
                stroke="#00FF41"
                strokeWidth="0.2"
                strokeDasharray="0.5 0.5"
                className="opacity-80"
              />
            ))}

            {/* Current Position Marker */}
            {currentPos && (
              <g transform={`translate(${currentPos.x}, ${currentPos.y})`}>
                {/* Ping Animation */}
                <circle r="1" fill="none" stroke="#00FF41" strokeWidth="0.1" className="opacity-0">
                  <animate attributeName="r" from="0.5" to="3" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="1" to="0" dur="2s" repeatCount="indefinite" />
                </circle>
                
                {/* Core Dot */}
                <circle r="0.6" fill="#00FF41" className="drop-shadow-[0_0_2px_#00FF41]" />
                
                {/* Crosshairs */}
                <line x1="-2" y1="0" x2="2" y2="0" stroke="#00FF41" strokeWidth="0.05" opacity="0.5" />
                <line x1="0" y1="-2" x2="0" y2="2" stroke="#00FF41" strokeWidth="0.05" opacity="0.5" />

                {/* Label */}
                <text x="1" y="-1" fontSize="1.5" fill="#00FF41" fontFamily="monospace" fontWeight="bold">
                  ISS_TARGET
                </text>
              </g>
            )}
          </svg>
          
          {/* Coordinates HUD */}
          {data && (
            <div className="absolute top-2 right-2 font-mono text-[10px] text-matrix-text bg-black/80 p-1 border border-matrix-dim z-20">
              POS: {data.latitude?.toFixed(2)}, {data.longitude?.toFixed(2)}
            </div>
          )}

          {/* Prediction Legend */}
          {predictedSegments.length > 0 && (
             <div className="absolute bottom-2 left-2 font-mono text-[8px] text-matrix-dim/70 z-20">
                -- -- PREDICTED PATH
             </div>
          )}
        </div>

        {/* Corner Decorations */}
        <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-matrix-dim"></div>
        <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-matrix-dim"></div>
        <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-matrix-dim"></div>
        <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-matrix-dim"></div>

      </div>

      {/* Sidebar Panel */}
      <div className="w-full md:w-80 flex-none h-[40vh] md:h-auto border-t md:border-t-0 border-matrix-dim">
        <StatsPanel data={data} isLoading={isLoading} />
      </div>
    </div>
  );
};