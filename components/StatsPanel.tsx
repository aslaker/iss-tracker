import React, { useEffect } from 'react';
import { ISSPosition } from '../types';
import { formatCoordinate } from '../lib/api';
import { Clock, Navigation, Activity, Zap } from 'lucide-react';
import { MatrixText } from './MatrixText';
import { terminalAudio } from '../lib/audio';

interface StatsPanelProps {
  data?: ISSPosition;
  isLoading: boolean;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({ data, isLoading }) => {
  // Play sound when data updates
  useEffect(() => {
    if (data) {
      terminalAudio.playDataUpdate();
    }
  }, [data]);

  if (isLoading || !data) {
    return (
      <div className="h-full w-full flex items-center justify-center border-l border-matrix-dim p-4">
        <div className="text-center animate-pulse">
          <p>ACQUIRING_SIGNAL...</p>
          <p className="text-xs text-matrix-dim mt-2">ESTABLISHING UPLINK</p>
        </div>
      </div>
    );
  }

  const StatBox = ({ label, value, unit, icon: Icon, subtext }: any) => (
    <div 
      className="mb-4 bg-matrix-dark/50 border border-matrix-dim p-3 hover:border-matrix-text transition-colors group relative overflow-hidden"
      onMouseEnter={() => terminalAudio.playHover()}
    >
      <div className="flex justify-between items-start mb-1">
        <span className="text-[10px] uppercase text-matrix-dim group-hover:text-matrix-text transition-colors">{label}</span>
        {Icon && <Icon className="w-3 h-3 text-matrix-dim" />}
      </div>
      <div className="text-xl md:text-2xl font-bold tracking-wider text-white">
        <MatrixText text={String(value)} />
        {unit && <span className="text-sm ml-1 text-matrix-text font-normal">{unit}</span>}
      </div>
      {subtext && <div className="text-[10px] text-matrix-dim mt-1">{subtext}</div>}
      
      {/* Scanline overlay for each box */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-matrix-dim/5 pointer-events-none"></div>
    </div>
  );

  return (
    <div className="h-full overflow-y-auto p-4 md:border-l border-matrix-dim bg-matrix-bg/80 backdrop-blur-md">
      <div className="mb-6 flex items-center gap-2 border-b border-matrix-dim pb-2">
        <Activity className="w-4 h-4 text-matrix-alert animate-pulse" />
        <h2 className="text-sm font-bold uppercase">
            <MatrixText text="Telemetry Data" speed={50} />
        </h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-1 gap-2">
        <StatBox
          label="Latitude"
          value={formatCoordinate(data.latitude, 'lat')}
          icon={Navigation}
        />
        <StatBox
          label="Longitude"
          value={formatCoordinate(data.longitude, 'lon')}
          icon={Navigation}
        />
        <StatBox
          label="Altitude"
          value={data.altitude.toFixed(1)}
          unit="km"
          icon={Activity}
          subtext="Orbital Height (Avg)"
        />
        <StatBox
          label="Velocity"
          value={Math.round(data.velocity).toLocaleString()}
          unit="km/h"
          icon={Zap}
          subtext="Orbital Speed (Avg)"
        />
        <StatBox
          label="Period"
          value="92.6"
          unit="min"
          icon={Clock}
          subtext="Orbit Duration"
        />
        <StatBox
          label="Last Update"
          value={new Date(data.timestamp * 1000).toLocaleTimeString([], { hour12: false })}
          icon={Activity}
          subtext="UTC Standard"
        />
      </div>

      <div className="mt-8 border-t border-matrix-dim pt-4">
        <h3 className="text-[10px] uppercase text-matrix-dim mb-2">System Logs</h3>
        <div className="font-mono text-[10px] space-y-1 opacity-70">
          <p>> DATA_SOURCE: WHERE_THE_ISS_AT_API</p>
          <p>> SIGNAL_STRENGTH: 98%</p>
          <p>> ENCRYPTION: AES-256</p>
          <p>> CONNECTION: STABLE</p>
        </div>
      </div>
    </div>
  );
};