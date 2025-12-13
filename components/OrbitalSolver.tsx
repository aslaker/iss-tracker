import React, { useMemo } from 'react';
import { calculateOrbitalParameters } from '../lib/api';
import { MatrixText } from './MatrixText';
import { Calculator, X, Cpu, Activity } from 'lucide-react';
import { terminalAudio } from '../lib/audio';

interface OrbitalSolverProps {
  tle?: [string, string];
  onClose: () => void;
}

export const OrbitalSolver: React.FC<OrbitalSolverProps> = ({ tle, onClose }) => {
  const params = useMemo(() => {
    if (!tle || tle.length !== 2) return null;
    return calculateOrbitalParameters(tle[0], tle[1]);
  }, [tle]);

  const SolverRow = ({ label, value, unit, desc }: { label: string, value: string, unit?: string, desc: string }) => (
    <div className="border-b border-matrix-dim/30 py-2 last:border-0 hover:bg-matrix-dim/10 transition-colors px-2 font-mono">
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-xs text-matrix-dim uppercase font-bold tracking-wider">{label}</span>
        <div className="text-right">
          <span className="text-matrix-text font-bold"><MatrixText text={value} speed={20} /></span>
          {unit && <span className="text-[10px] text-matrix-dim ml-1">{unit}</span>}
        </div>
      </div>
      <div className="text-[9px] text-matrix-dim/70 tracking-tight">
        >> {desc}
      </div>
    </div>
  );

  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-md bg-black/95 border border-matrix-text z-50 shadow-[0_0_30px_rgba(0,255,65,0.2)] animate-in fade-in zoom-in-95 duration-200">
      
      {/* Terminal Header */}
      <div className="flex items-center justify-between p-2 bg-matrix-dim/20 border-b border-matrix-dim cursor-move">
         <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-matrix-text animate-pulse" />
            <span className="font-bold text-sm tracking-widest text-matrix-text uppercase">Orbital_Solver.exe</span>
         </div>
         <button 
           onClick={() => {
             terminalAudio.playClick();
             onClose();
           }}
           className="text-matrix-dim hover:text-matrix-text transition-colors p-1"
         >
           <X className="w-4 h-4" />
         </button>
      </div>

      {/* Content */}
      <div className="p-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {!params ? (
             <div className="p-8 text-center border border-matrix-dim border-dashed">
               <Activity className="w-8 h-8 text-matrix-dim mx-auto mb-2 animate-spin" />
               <p className="text-xs text-matrix-dim animate-pulse">AWAITING_TLE_DATA_STREAM...</p>
             </div>
          ) : (
            <div className="flex flex-col gap-1">
               {/* Decorative ASCII-like header */}
               <div className="text-[10px] text-matrix-dim mb-2 font-mono opacity-70">
                 ----------------------------------------<br/>
                 // CALCULATING KEPLERIAN ELEMENTS<br/>
                 // REF FRAME: J2000 EPOCH<br/>
                 ----------------------------------------
               </div>

               <SolverRow 
                 label="Inclination" 
                 value={params.inclination.toFixed(4)} 
                 unit="deg" 
                 desc="EQUATORIAL_DIVERGENCE_VECTOR"
               />
               <SolverRow 
                 label="Eccentricity" 
                 value={params.eccentricity.toFixed(7)} 
                 desc="ORBITAL_ELLIPTICITY_COEFF"
               />
               <SolverRow 
                 label="Mean Motion" 
                 value={params.meanMotion.toFixed(4)} 
                 unit="rev/day" 
                 desc="ANGULAR_VELOCITY_MEAN"
               />
               <SolverRow 
                 label="Perigee" 
                 value={params.perigee.toFixed(2)} 
                 unit="km" 
                 desc="PERIAPSIS_ALTITUDE (MIN)"
               />
               <SolverRow 
                 label="Apogee" 
                 value={params.apogee.toFixed(2)} 
                 unit="km" 
                 desc="APOAPSIS_ALTITUDE (MAX)"
               />
               <SolverRow 
                 label="Period" 
                 value={params.period.toFixed(2)} 
                 unit="min" 
                 desc="SIDEREAL_ORBIT_TIME"
               />
               
               <div className="mt-4 p-3 bg-matrix-dim/5 border border-matrix-dim/30 text-[9px] text-matrix-dim font-mono">
                 <div className="flex items-center gap-2 mb-1 text-matrix-text">
                   <Calculator className="w-3 h-3" />
                   <span className="font-bold">SOLVER_STATUS: CONVERGED</span>
                 </div>
                 <p className="mb-1">PROPAGATION_MODEL: SGP4/SDP4</p>
                 <p className="opacity-50">>> CALC_TIME: 4ms</p>
               </div>
            </div>
          )}
      </div>

      {/* Footer decoration */}
      <div className="h-1 bg-matrix-text/20 w-full relative overflow-hidden">
         <div className="absolute inset-0 bg-matrix-text/50 w-1/3 animate-[shimmer_2s_infinite]"></div>
      </div>
    </div>
  );
};