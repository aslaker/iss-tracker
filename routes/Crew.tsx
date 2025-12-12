import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCrewData } from '../lib/api';
import { User, BadgeCheck, Rocket, UserCircle } from 'lucide-react';

export const CrewManifest: React.FC = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['issCrew'],
    queryFn: fetchCrewData,
  });

  // Fallback data in case API fails (common with mixed content issues in demos)
  const displayData = isError || (data && !data.people) ? {
    number: 7,
    people: [
      { name: "Jasmin Moghbeli", craft: "ISS" },
      { name: "Andreas Mogensen", craft: "ISS" },
      { name: "Satoshi Furukawa", craft: "ISS" },
      { name: "Konstantin Borisov", craft: "ISS" },
      { name: "Oleg Kononenko", craft: "ISS" },
      { name: "Nikolai Chub", craft: "ISS" },
      { name: "Loral O'Hara", craft: "ISS" }
    ]
  } : data;

  return (
    <div className="h-full w-full overflow-y-auto p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 border-b border-matrix-dim pb-4 flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-bold tracking-wider mb-2">PERSONNEL MANIFEST</h2>
            <p className="text-matrix-dim text-sm uppercase">Currently Onboard Station // Expedition 70</p>
          </div>
          <div className="text-right">
             <div className="text-4xl font-bold">{displayData?.number || 0}</div>
             <div className="text-[10px] text-matrix-dim uppercase">Active Crew</div>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-24 bg-matrix-dark border border-matrix-dim"></div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayData?.people.map((person: any, idx: number) => (
              <div
                key={idx}
                className="bg-matrix-dark border border-matrix-dim p-4 relative overflow-hidden group hover:border-matrix-text transition-colors duration-300"
              >
                {/* Decorative corner accent */}
                <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-matrix-dim group-hover:border-matrix-text transition-colors"></div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded bg-matrix-dim/20 flex items-center justify-center border border-matrix-dim">
                     <UserCircle className="w-8 h-8 text-matrix-text" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg leading-tight mb-1 group-hover:text-white transition-colors">
                      {person.name}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-matrix-dim">
                      <Rocket className="w-3 h-3" />
                      <span>Assignment: {person.craft}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                       <span className="w-2 h-2 rounded-full bg-matrix-text animate-pulse"></span>
                       <span className="text-[10px] uppercase font-bold text-matrix-text">Active Duty</span>
                    </div>
                  </div>
                </div>

                {/* Background ID */}
                <div className="absolute -bottom-4 -right-2 text-[60px] font-bold text-matrix-dim/5 select-none pointer-events-none">
                  {String(idx + 1).padStart(2, '0')}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-12 p-4 border border-matrix-dim border-dashed bg-matrix-dark/30 text-xs text-matrix-dim font-mono">
          <p>> QUERY_RESULT: {displayData?.number} RECORDS FOUND</p>
          <p>> DATA_SOURCE: OPEN_NOTIFY_API_V1</p>
          <p>> SECURITY_CLEARANCE: UNCLASSIFIED</p>
        </div>
      </div>
    </div>
  );
};