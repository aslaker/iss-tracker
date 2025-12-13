import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCrewData } from '../lib/api';
import { Rocket, UserCircle, Calendar, Clock, AlertTriangle, BadgeCheck, Network, Radio } from 'lucide-react';
import { MatrixText } from '../components/MatrixText';
import { Astronaut } from '../types';

// Helper to calculate time in orbit based on dynamic launch date
const getMissionStats = (person: Astronaut) => {
  const { launchDate, endDate, role } = person;

  // Defaults if no data
  if (!launchDate) {
    return {
      role: role || "Flight Engineer",
      daysInOrbit: "???",
      progress: 0,
      startStr: "CLASSIFIED",
      endStr: "UNKNOWN",
      isUnknown: true
    };
  }

  const start = new Date(launchDate).getTime();
  const now = Date.now();
  
  // Determine end date:
  // 1. Explicit end date from DB (e.g. for known return dates)
  // 2. Default standard duration (180 days)
  let end: number;
  let isEstimatedEnd = true;

  if (endDate) {
    end = new Date(endDate).getTime();
    isEstimatedEnd = false;
  } else {
    const ESTIMATED_DURATION_MS = 180 * 24 * 60 * 60 * 1000;
    end = start + ESTIMATED_DURATION_MS;
  }

  const elapsed = now - start;
  const totalDuration = end - start;
  
  // Calculate days
  const daysInOrbit = Math.floor(elapsed / (1000 * 60 * 60 * 24));
  
  // Calculate percentage (clamped 0-100)
  const progress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));

  return {
    role: role || "Mission Specialist",
    daysInOrbit: daysInOrbit > 0 ? daysInOrbit : 0,
    progress,
    startStr: new Date(launchDate).toISOString().split('T')[0],
    endStr: (isEstimatedEnd ? "Est. " : "") + new Date(end).toISOString().split('T')[0],
    isUnknown: false
  };
};

// Component for handling Image loading states
const CrewImage: React.FC<{ src?: string; alt: string }> = ({ src, alt }) => {
    const [error, setError] = useState(false);

    if (!src || error) {
        return <UserCircle className="w-12 h-12 text-matrix-dim" />;
    }

    return (
        <>
            <img 
            src={src} 
            alt={alt}
            onError={() => setError(true)}
            className="w-full h-full object-cover grayscale sepia brightness-75 contrast-125 hue-rotate-[70deg] hover:grayscale-0 hover:sepia-0 hover:brightness-100 hover:contrast-100 hover:hue-rotate-0 transition-all duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent pointer-events-none"></div>
        </>
    );
};

export const CrewManifest: React.FC = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['issCrew'],
    queryFn: fetchCrewData,
    staleTime: 1000 * 60 * 60, // 1 hour cache
  });

  const crewCount = data?.people?.length || 0;

  return (
    <div className="h-full w-full overflow-y-auto p-4 md:p-8 custom-scrollbar">
      <div className="max-w-6xl mx-auto pb-12">
        <div className="mb-8 border-b border-matrix-dim pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-wider mb-2 glitch-text" data-text="PERSONNEL MANIFEST">
              PERSONNEL MANIFEST
            </h2>
            <p className="text-matrix-dim text-sm uppercase flex items-center gap-2">
              <span className="w-2 h-2 bg-matrix-dim rounded-full animate-pulse"></span>
              Live Uplink // The Space Devs Network
            </p>
          </div>
          <div className="flex gap-8 text-right bg-matrix-dark/50 p-2 border border-matrix-dim/30">
             <div>
                <div className="text-2xl font-bold text-matrix-text">{crewCount}</div>
                <div className="text-[9px] text-matrix-dim uppercase tracking-wider">Active Crew</div>
             </div>
             <div>
                <div className="text-2xl font-bold text-matrix-text">ISS</div>
                <div className="text-[9px] text-matrix-dim uppercase tracking-wider">Sector 4</div>
             </div>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-64 bg-matrix-dark border border-matrix-dim relative overflow-hidden">
                 <div className="absolute top-4 left-4 w-12 h-12 bg-matrix-dim/20 rounded"></div>
                 <div className="absolute top-20 left-4 w-3/4 h-4 bg-matrix-dim/20 rounded"></div>
                 <div className="absolute top-28 left-4 w-1/2 h-4 bg-matrix-dim/20 rounded"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {data?.people.map((person: Astronaut, idx: number) => {
              const stats = getMissionStats(person);
              
              return (
                <div
                  key={person.name}
                  className="bg-matrix-dark/90 backdrop-blur-sm border border-matrix-dim p-5 relative overflow-hidden group hover:border-matrix-text transition-all duration-300 flex flex-col justify-between"
                >
                  {/* Decorative corner accent */}
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-matrix-dim group-hover:border-matrix-text transition-colors"></div>
                  
                  {/* Header Section */}
                  <div className="flex items-start gap-4 mb-6 relative z-10">
                    <div className="w-20 h-20 rounded bg-matrix-dim/10 flex items-center justify-center border border-matrix-dim/50 group-hover:bg-matrix-text/10 transition-colors shrink-0 overflow-hidden relative">
                       <CrewImage src={person.image} alt={person.name} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <h3 className="font-bold text-xl leading-tight truncate text-white group-hover:text-matrix-text transition-colors pr-2">
                          {person.name}
                        </h3>
                        <span className="text-[10px] font-mono text-matrix-dim border border-matrix-dim px-1 rounded opacity-50">
                            ID: {String(idx + 1).padStart(3, '0')}
                        </span>
                      </div>
                      
                      <div className="text-sm text-matrix-text/80 font-bold mb-1 uppercase tracking-wider flex items-center gap-2">
                        {stats.role}
                        {person.agency && (
                            <span className="text-[9px] text-black bg-matrix-dim px-1 rounded font-bold">{person.agency}</span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-3 text-xs text-matrix-dim mt-2">
                        <div className="flex items-center gap-1">
                            <Rocket className="w-3 h-3" />
                            <span>{person.craft}</span>
                        </div>
                        <div className="w-px h-3 bg-matrix-dim/50"></div>
                        <div className="flex items-center gap-1">
                            {person.image ? (
                                <BadgeCheck className="w-3 h-3 text-matrix-text" />
                            ) : (
                                <Network className="w-3 h-3" />
                            )}
                            <span className="uppercase">{person.image ? 'VERIFIED_ID' : 'NO_VISUAL'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Timeline Section */}
                  <div className="bg-black/40 border border-matrix-dim/30 p-3 relative z-10 min-h-[100px] flex flex-col justify-center">
                    {stats.isUnknown ? (
                        <div className="flex flex-col items-center justify-center py-2 text-matrix-dim/60 gap-1 text-center">
                            <Radio className="w-5 h-5 opacity-50 mb-1" />
                            <div className="text-xs font-bold tracking-widest text-matrix-text/70 uppercase">
                                STATUS: MISSION CONCLUDED
                            </div>
                            <div className="text-[9px] uppercase tracking-wider opacity-60">
                                Crew member has likely returned to Earth.<br/>
                                Telemetry stream inactive.
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="flex justify-between items-end mb-2">
                                <div className="flex flex-col">
                                    <span className="text-[9px] uppercase text-matrix-dim mb-0.5">Time in Orbit</span>
                                    <span className="text-2xl font-bold font-mono leading-none text-white">
                                        T+<MatrixText text={String(stats.daysInOrbit)} speed={50} />
                                        <span className="text-xs ml-1 text-matrix-dim font-normal">DAYS</span>
                                    </span>
                                </div>
                                <div className="flex items-center gap-1 text-xs text-matrix-dim font-mono">
                                    <Clock className="w-3 h-3" />
                                    <span>{Math.round(stats.progress)}% EST.</span>
                                </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="w-full h-2 bg-matrix-dim/10 border border-matrix-dim/30 relative overflow-hidden mb-2">
                                <div 
                                    className="h-full bg-matrix-text shadow-[0_0_10px_rgba(0,255,65,0.5)] relative transition-all duration-1000"
                                    style={{ width: `${stats.progress}%` }}
                                >
                                    {/* Stripes effect */}
                                    <div className="absolute inset-0 w-full h-full" style={{
                                        backgroundImage: 'linear-gradient(45deg,rgba(0,0,0,0.3) 25%,transparent 25%,transparent 50%,rgba(0,0,0,0.3) 50%,rgba(0,0,0,0.3) 75%,transparent 75%,transparent)',
                                        backgroundSize: '8px 8px'
                                    }}></div>
                                </div>
                            </div>

                            <div className="flex justify-between text-[9px] font-mono text-matrix-dim uppercase">
                                <div className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3 opacity-50" />
                                    <span>Launch: {stats.startStr}</span>
                                </div>
                                <span>Return: {stats.endStr}</span>
                            </div>
                        </>
                    )}
                  </div>

                  {/* Background decoration */}
                  <div className="absolute -bottom-6 -right-6 text-[80px] font-bold text-matrix-dim/5 select-none pointer-events-none font-mono z-0">
                    MK-{String(idx + 1).padStart(2, '0')}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-12 p-4 border border-matrix-dim border-dashed bg-matrix-dark/30 text-xs text-matrix-dim font-mono flex flex-col md:flex-row justify-between gap-4">
          <div className="space-y-1">
            <p>> DATA_FUSION: OPEN_NOTIFY (MANIFEST) + LAUNCH_LIBRARY_2 (METADATA)</p>
            <p>> FILTER_MODE: ISS_ONLY // ACTIVE_STATUS</p>
            <p>> CACHE_STATUS: {isLoading ? 'REFRESHING' : 'VALID'}</p>
          </div>
          <div className="text-right opacity-50">
             <p>PERSONNEL_TRACKING_SYSTEM</p>
             <p>SECURE_LINK // TSD_API_V2.2.0</p>
          </div>
        </div>
      </div>
    </div>
  );
};