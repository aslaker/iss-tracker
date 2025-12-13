import React, { useEffect, useRef, useState, useMemo } from 'react';
import Globe, { GlobeMethods } from 'react-globe.gl';
import { useQuery } from '@tanstack/react-query';
import { fetchISSPosition, fetchTLE, calculateOrbitPath } from '../lib/api';
import { StatsPanel } from '../components/StatsPanel';
import { OrbitalSolver } from '../components/OrbitalSolver';
import { FlyoverControl } from '../components/FlyoverControl';
import { Minimize, RotateCw, Calculator } from 'lucide-react';
import { terminalAudio } from '../lib/audio';
import { useLocationContext } from '../context/LocationContext';

export const ISSTracker: React.FC = () => {
  const globeEl = useRef<GlobeMethods | undefined>(undefined);
  const [globeReady, setGlobeReady] = useState(false);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [showOrbitalSolver, setShowOrbitalSolver] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // User Location Context
  const { userLocation, nextPass } = useLocationContext();

  // Live Position
  const { data, isLoading, isError } = useQuery({
    queryKey: ['issPosition'],
    queryFn: fetchISSPosition,
    refetchInterval: 5000,
  });

  // TLE Data
  const { data: tleData } = useQuery({
    queryKey: ['issTLE'],
    queryFn: fetchTLE,
    staleTime: 1000 * 60 * 60,
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
    handleResize(); 
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Center Globe on ISS (Initial or manual trigger)
  useEffect(() => {
    if (data && globeEl.current && 
        typeof data.latitude === 'number' && !isNaN(data.latitude) &&
        typeof data.longitude === 'number' && !isNaN(data.longitude)) {
      globeEl.current.pointOfView({
        lat: data.latitude,
        lng: data.longitude,
        altitude: 1.8 
      }, 1000);
    }
  }, [data]);

  const { historyPath, predictedPath } = useMemo(() => {
    if (!tleData || !Array.isArray(tleData) || tleData.length < 2) {
        return { historyPath: [], predictedPath: [] };
    }
    
    // Calculate paths
    const hist = calculateOrbitPath(tleData[0], tleData[1], -45, 0);
    const pred = calculateOrbitPath(tleData[0], tleData[1], 0, 60);

    return { 
      historyPath: hist.length > 0 ? hist : [], 
      predictedPath: pred.length > 0 ? pred : [] 
    };
  }, [tleData]);

  // Consolidate paths for the globe prop. 
  // ADDITION: If nextPass exists, add it as a distinct yellow path
  const globePathsData = useMemo(() => {
      const paths = [];
      if (historyPath.length > 1) paths.push(historyPath);
      if (predictedPath.length > 1) paths.push(predictedPath);
      
      // Add the flyover arc if valid
      if (nextPass && nextPass.path && nextPass.path.length > 1) {
          paths.push(nextPass.path);
      }
      return paths;
  }, [historyPath, predictedPath, nextPass]);

  // Points Data: ISS + User Location
  const gData = useMemo(() => {
    const points = [];

    // 1. ISS
    if (data && 
        typeof data.latitude === 'number' && !isNaN(data.latitude) && 
        typeof data.longitude === 'number' && !isNaN(data.longitude)) {
      points.push({
        lat: data.latitude,
        lng: data.longitude,
        alt: 0.1,
        radius: 1.5,
        color: '#00FF41',
        label: 'ISS'
      });
    }

    // 2. User Location (Target)
    if (userLocation) {
        points.push({
            lat: userLocation.lat,
            lng: userLocation.lng,
            alt: 0.02,
            radius: 0.8,
            color: '#FFD700', // Gold
            label: 'USER'
        });
    }

    return points;
  }, [data, userLocation]);

  // Rings Data (ISS Ping) + User Ping
  const ringsData = useMemo(() => {
    const rings = [];
    
    if (data && !isNaN(data.latitude)) {
      rings.push({
        lat: data.latitude,
        lng: data.longitude,
        alt: 0.1,
        maxR: 8,
        propagationSpeed: 4,
        repeatPeriod: 1000,
        color: '#00FF41'
      });
    }

    if (userLocation) {
        rings.push({
            lat: userLocation.lat,
            lng: userLocation.lng,
            alt: 0.02,
            maxR: 5,
            propagationSpeed: 2,
            repeatPeriod: 2000,
            color: '#FFD700'
        });
    }

    return rings;
  }, [data, userLocation]);

  return (
    <div className="flex flex-col md:flex-row h-full w-full relative">
      <div ref={containerRef} className="flex-1 relative bg-black overflow-hidden border-r border-matrix-dim">
        
        {/* HUD Controls */}
        <div className="absolute top-4 left-4 z-10 flex gap-2">
           <button
             onClick={() => {
               terminalAudio.playClick();
               if(data && !isNaN(data.latitude) && !isNaN(data.longitude)) {
                 globeEl.current?.pointOfView({ lat: data.latitude, lng: data.longitude, altitude: 1.8 }, 1000)
               }
             }}
             onMouseEnter={() => terminalAudio.playHover()}
             className="bg-matrix-dark/80 border border-matrix-dim text-matrix-text p-2 hover:bg-matrix-dim/20 transition group"
             title="Track ISS"
           >
             <Minimize className="w-4 h-4 group-hover:scale-110 transition-transform" />
           </button>
           <button
             onClick={() => {
                 terminalAudio.playClick();
                 globeEl.current?.pointOfView({ lat: 0, lng: 0, altitude: 2.5 }, 1000);
             }}
             onMouseEnter={() => terminalAudio.playHover()}
             className="bg-matrix-dark/80 border border-matrix-dim text-matrix-text p-2 hover:bg-matrix-dim/20 transition group"
             title="Reset Camera"
           >
             <RotateCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
           </button>
           
           <button
             onClick={() => {
                 terminalAudio.playClick();
                 setShowOrbitalSolver(!showOrbitalSolver);
             }}
             onMouseEnter={() => terminalAudio.playHover()}
             className={`bg-matrix-dark/80 border text-matrix-text p-2 hover:bg-matrix-dim/20 transition group flex items-center gap-2 ${showOrbitalSolver ? 'border-matrix-text shadow-[0_0_10px_rgba(0,255,65,0.3)]' : 'border-matrix-dim'}`}
             title="Orbital Parameters"
           >
             <Calculator className="w-4 h-4" />
             <span className="text-xs font-bold hidden md:inline">ORBIT_DATA</span>
           </button>
        </div>

        {/* Modal Overlay */}
        {showOrbitalSolver && (
          <OrbitalSolver 
            tle={tleData} 
            onClose={() => {
              terminalAudio.playClick();
              setShowOrbitalSolver(false);
            }} 
          />
        )}
        
        {/* Flyover Control Panel */}
        <FlyoverControl />

        {predictedPath.length > 0 && (
          <div className="absolute top-4 right-4 z-10 pointer-events-none">
            <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2 text-[10px] text-matrix-dim bg-black/50 p-1 border border-matrix-dim/30">
                <span className="w-3 h-0.5 bg-[#00FF41] opacity-50 border-t border-b border-black"></span>
                <span>ORBITAL_PATH (TLE_PROJECTION)</span>
                </div>
                {nextPass && (
                    <div className="flex items-center gap-2 text-[10px] text-yellow-500 bg-black/50 p-1 border border-yellow-900/50">
                    <span className="w-3 h-0.5 bg-yellow-500 border-t border-b border-black"></span>
                    <span>FLYOVER_ARC</span>
                    </div>
                )}
            </div>
          </div>
        )}

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
          
          pointsData={gData}
          pointAltitude="alt"
          pointColor="color"
          pointRadius="radius"
          pointPulseBtn={0.5}
          
          ringsData={ringsData}
          ringColor="color"
          ringMaxRadius="maxR"
          ringPropagationSpeed="propagationSpeed"
          ringRepeatPeriod="repeatPeriod"
          
          pathsData={globePathsData}
          pathPointLat={(p: any) => p.lat}
          pathPointLng={(p: any) => p.lng}
          pathPointAlt={0.1}
          pathColor={(path: any) => {
              if (path === nextPass?.path) return '#FFD700'; // Gold for flyover
              if (path === predictedPath) return 'rgba(0, 255, 65, 0.5)';
              return '#00FF41';
          }}
          pathDashLength={(path: any) => path === predictedPath ? 0.5 : 0.05}
          pathDashGap={(path: any) => path === predictedPath ? 0.2 : 0}
          pathDashAnimateTime={(path: any) => path === predictedPath ? 0 : 20000}
          pathResolution={2} 
          
          onGlobeReady={() => setGlobeReady(true)}
        />
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,#000000_120%)]"></div>
      </div>

      <div className="w-full md:w-80 lg:w-96 flex-none flex flex-col h-[40vh] md:h-auto border-t md:border-t-0 border-matrix-dim overflow-y-auto custom-scrollbar bg-matrix-bg">
        <StatsPanel data={data} isLoading={isLoading} />
        <div className="p-4 border-t border-matrix-dim/30 text-center opacity-50 hover:opacity-100 transition-opacity">
           <div className="text-[10px] text-matrix-dim mb-2">ADDITIONAL MODULES</div>
           <div className="grid grid-cols-3 gap-2">
              <div className="h-1 bg-matrix-dim/30"></div>
              <div className="h-1 bg-matrix-dim/30"></div>
              <div className="h-1 bg-matrix-dim/30"></div>
           </div>
        </div>
      </div>
    </div>
  );
};
