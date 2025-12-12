import React, { useEffect, useRef, useState, useMemo } from 'react';
import Globe, { GlobeMethods } from 'react-globe.gl';
import { useQuery } from '@tanstack/react-query';
import { fetchISSPosition, fetchTLE, predictOrbit } from '../lib/api';
import { StatsPanel } from '../components/StatsPanel';
import { Maximize, Minimize, RotateCw } from 'lucide-react';

export const ISSTracker: React.FC = () => {
  const globeEl = useRef<GlobeMethods | undefined>(undefined);
  const [globeReady, setGlobeReady] = useState(false);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const containerRef = useRef<HTMLDivElement>(null);

  // Live Position Query
  const { data, isLoading, isError } = useQuery({
    queryKey: ['issPosition'],
    queryFn: fetchISSPosition,
    refetchInterval: 5000,
  });

  // TLE / Prediction Query
  const { data: tleData } = useQuery({
    queryKey: ['issTLE'],
    queryFn: fetchTLE,
    staleTime: 1000 * 60 * 60, // 1 hour cache for TLE
  });

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update Globe Position (Center on ISS)
  useEffect(() => {
    if (data && globeEl.current && 
        typeof data.latitude === 'number' && !isNaN(data.latitude) &&
        typeof data.longitude === 'number' && !isNaN(data.longitude)) {
      globeEl.current.pointOfView({
        lat: data.latitude,
        lng: data.longitude,
        altitude: 1.8 // View altitude
      }, 1000);
    }
  }, [data]);

  // Generate Trailed Path Data (History)
  interface PathPoint {
    lat: number;
    lng: number;
    alt: number;
  }
  const [historyPath, setHistoryPath] = useState<PathPoint[]>([]);

  useEffect(() => {
    if (data && typeof data.latitude === 'number' && typeof data.longitude === 'number' && 
        !isNaN(data.latitude) && !isNaN(data.longitude)) {
      setHistoryPath(prev => {
        const newPoint: PathPoint = { lat: data.latitude, lng: data.longitude, alt: 0.1 };
        const newPath = [...prev, newPoint];
        // Keep trail length manageable
        if (newPath.length > 50) return newPath.slice(newPath.length - 50);
        return newPath;
      });
    }
  }, [data]);

  // Generate Predicted Path Data
  const predictedPath = useMemo(() => {
    if (!tleData) return [];
    const points = predictOrbit(tleData[0], tleData[1], 65); // 65 minutes prediction
    return points.map(p => ({ lat: p.lat, lng: p.lng, alt: 0.1 }));
  }, [tleData]);

  const gData = useMemo(() => {
    return (data && typeof data.latitude === 'number' && typeof data.longitude === 'number') ? [{
      lat: data.latitude,
      lng: data.longitude,
      alt: 0.1,
      radius: 1.5,
      color: '#00FF41'
    }] : [];
  }, [data]);

  const ringsData = useMemo(() => {
    return (data && typeof data.latitude === 'number' && typeof data.longitude === 'number') ? [{
      lat: data.latitude,
      lng: data.longitude,
      alt: 0.1,
      maxR: 8,
      propagationSpeed: 4,
      repeatPeriod: 1000
    }] : [];
  }, [data]);

  return (
    <div className="flex flex-col md:flex-row h-full w-full relative">
      {/* 3D Globe Container */}
      <div ref={containerRef} className="flex-1 relative bg-black overflow-hidden border-r border-matrix-dim">
        <div className="absolute top-4 left-4 z-10 flex gap-2">
           <button
             onClick={() => {
               if(data && typeof data.latitude === 'number' && !isNaN(data.latitude)) {
                 globeEl.current?.pointOfView({ lat: data.latitude, lng: data.longitude, altitude: 1.8 }, 1000)
               }
             }}
             className="bg-matrix-dark/80 border border-matrix-dim text-matrix-text p-2 hover:bg-matrix-dim/20 transition"
             title="Re-center ISS"
           >
             <Minimize className="w-4 h-4" />
           </button>
           <button
             onClick={() => globeEl.current?.pointOfView({ lat: 0, lng: 0, altitude: 2.5 }, 1000)}
             className="bg-matrix-dark/80 border border-matrix-dim text-matrix-text p-2 hover:bg-matrix-dim/20 transition"
             title="Reset View"
           >
             <RotateCw className="w-4 h-4" />
           </button>
        </div>

        {/* Legend / Status for Prediction */}
        {predictedPath.length > 0 && (
          <div className="absolute top-4 right-4 z-10 pointer-events-none">
            <div className="flex items-center gap-2 text-[10px] text-matrix-dim bg-black/50 p-1 border border-matrix-dim/30">
              <span className="w-3 h-0.5 bg-[#00FF41] opacity-50 border-t border-b border-black"></span>
              <span>PREDICTED_ORBIT (+60MIN)</span>
            </div>
          </div>
        )}

        {/* Loading / Error States */}
        {isLoading && !globeReady && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <div className="text-matrix-text animate-pulse font-mono text-xl">INITIALIZING TERRAIN GENERATION...</div>
          </div>
        )}

        {isError && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
             <div className="bg-matrix-dark border border-matrix-alert text-matrix-alert p-4 rounded animate-pulse">
               SIGNAL_LOST // RETRYING
             </div>
          </div>
        )}

        <Globe
          ref={globeEl}
          width={dimensions.width}
          height={dimensions.height}
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
          backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
          atmosphereColor="#00FF41"
          atmosphereAltitude={0.15}
          
          // Points
          pointsData={gData}
          pointAltitude="alt"
          pointColor="color"
          pointRadius="radius"
          pointPulseBtn={0.5}
          
          // Rings
          ringsData={ringsData}
          ringColor={() => '#00FF41'}
          ringMaxRadius="maxR"
          ringPropagationSpeed="propagationSpeed"
          ringRepeatPeriod="repeatPeriod"
          
          // Paths
          pathsData={[
            // Historical Path (Solid/Bright)
            historyPath,
            // Predicted Path (Faint/Dashed logic via opacity)
            predictedPath
          ]}
          pathColor={(path: any) => path === predictedPath ? 'rgba(0, 255, 65, 0.4)' : '#00FF41'}
          pathDashLength={(path: any) => path === predictedPath ? 0.5 : 0.1}
          pathDashGap={(path: any) => path === predictedPath ? 0.2 : 0.05}
          pathDashAnimateTime={(path: any) => path === predictedPath ? 0 : 2000} // Don't animate prediction path
          pathPointAlt={0.1}
          
          onGlobeReady={() => setGlobeReady(true)}
        />

        {/* Overlay Grid/Decorations */}
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,#000000_120%)]"></div>
      </div>

      {/* Sidebar Panel */}
      <div className="w-full md:w-80 lg:w-96 flex-none h-[40vh] md:h-auto border-t md:border-t-0 border-matrix-dim">
        <StatsPanel data={data} isLoading={isLoading} />
      </div>
    </div>
  );
};