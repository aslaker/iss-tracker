import React, { useEffect, useState } from 'react';
import {
  Outlet,
  RouterProvider,
  createRouter,
  createRoute,
  createRootRoute,
  createMemoryHistory,
  Link,
  useLocation
} from '@tanstack/react-router';
import {
  QueryClient,
  QueryClientProvider
} from '@tanstack/react-query';
import { Globe, Map as MapIcon, Users, Terminal, Activity, Menu, X, Volume2, VolumeX, Power } from 'lucide-react';
import { ISSTracker } from './routes/Dashboard'; 
import { CrewManifest } from './routes/Crew';
import { MapView } from './routes/MapRoute';
import { terminalAudio } from './lib/audio';

// -- Query Client Setup --
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5000,
    },
  },
});

// -- Layout Component --
const RootComponent = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [muted, setMuted] = useState(terminalAudio.isMuted);
  const [isInitialized, setIsInitialized] = useState(false);
  const [poweredOn, setPoweredOn] = useState(false);
  const location = useLocation();

  // Handle System Initialization (Audio Context Unlock)
  const handleInitialize = async () => {
    await terminalAudio.resume();
    setIsInitialized(true);
  };

  // "Turn On" CRT Effect - Only runs after initialization
  useEffect(() => {
    if (isInitialized) {
      // Small delay to ensure CSS transitions trigger and audio context is ready
      const timer = setTimeout(() => {
          setPoweredOn(true);
          terminalAudio.playStartup();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isInitialized]);

  const navItems = [
    { to: '/', label: '3D_GLOBE', icon: Globe },
    { to: '/map', label: '2D_MAP', icon: MapIcon },
    { to: '/crew', label: 'CREW_MANIFEST', icon: Users },
  ];

  const isActive = (path: string) => location.pathname === path;

  const handleMuteToggle = () => {
    const newMuteState = terminalAudio.toggleMute();
    setMuted(newMuteState);
    if (!newMuteState) terminalAudio.playClick();
  };

  // Pre-initialization Screen (Audio Unlocker)
  if (!isInitialized) {
    return (
      <div className="w-full h-screen bg-black flex flex-col items-center justify-center font-mono text-matrix-text relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none scanlines opacity-50"></div>
        
        <div className="z-10 text-center space-y-8 animate-pulse">
           <div className="flex flex-col items-center gap-4">
             <Terminal className="w-16 h-16" />
             <h1 className="text-2xl md:text-4xl font-bold tracking-[0.5em] uppercase">ISS_TRACKER</h1>
           </div>
           
           <div className="space-y-2 text-matrix-dim text-sm">
             <p>SECURE CONNECTION REQUIRED</p>
             <p>AWAITING USER INPUT...</p>
           </div>

           <button 
             onClick={handleInitialize}
             className="group relative px-8 py-4 bg-transparent border border-matrix-text text-matrix-text hover:bg-matrix-text hover:text-black transition-all duration-300 font-bold tracking-widest uppercase"
           >
             <span className="flex items-center gap-3">
               <Power className="w-4 h-4" />
               INITIALIZE_UPLINK
             </span>
             {/* Decorative corners */}
             <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-matrix-text -translate-x-1 -translate-y-1 group-hover:translate-x-0 group-hover:translate-y-0 transition-all"></div>
             <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-matrix-text translate-x-1 translate-y-1 group-hover:translate-x-0 group-hover:translate-y-0 transition-all"></div>
           </button>
        </div>
      </div>
    );
  }

  // Main App Interface
  return (
    // The "crt-container" handles the scale animation
    <div className={`w-full h-screen bg-black flex items-center justify-center overflow-hidden transition-opacity duration-1000 ${poweredOn ? 'opacity-100' : 'opacity-0'}`}>
       <div className={`w-full h-full flex flex-col bg-matrix-bg text-matrix-text font-mono relative crt-turn-on`}>
          
          {/* Header */}
          <header className="flex-none h-16 border-b border-matrix-dim flex items-center justify-between px-4 z-40 bg-matrix-bg/90 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <Terminal className="w-6 h-6 animate-pulse text-matrix-dim" />
              <div>
                <h1 className="text-xl font-bold tracking-widest uppercase drop-shadow-[0_0_5px_rgba(0,255,65,0.8)] glitch-text" data-text="ISS_TRACKER">
                  ISS_TRACKER
                </h1>
                <div className="flex items-center gap-2 text-[10px] text-matrix-dim">
                  <span className="w-2 h-2 rounded-full bg-matrix-text animate-pulse-fast"></span>
                  <span>LIVE_FEED__CONNECTED</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
                {/* Desktop Nav */}
                <nav className="hidden md:flex items-center gap-1">
                {navItems.map((item) => (
                    <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => terminalAudio.playClick()}
                    onMouseEnter={() => terminalAudio.playHover()}
                    className={`
                        px-4 py-2 flex items-center gap-2 border border-transparent hover:border-matrix-dim transition-all duration-300
                        ${isActive(item.to) ? 'bg-matrix-dark border-matrix-text text-matrix-text shadow-[0_0_10px_rgba(0,255,65,0.2)]' : 'text-matrix-dim hover:text-matrix-text'}
                    `}
                    >
                    <item.icon className="w-4 h-4" />
                    <span className="text-sm font-bold">{item.label}</span>
                    </Link>
                ))}
                </nav>

                <button 
                  onClick={handleMuteToggle}
                  className="p-2 text-matrix-dim hover:text-matrix-text border border-transparent hover:border-matrix-dim transition-all"
                  title="Toggle Audio"
                >
                    {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>

                {/* Mobile Menu Toggle */}
                <button
                    className="md:hidden p-2 text-matrix-text border border-matrix-dim"
                    onClick={() => {
                        setMobileMenuOpen(!mobileMenuOpen);
                        terminalAudio.playClick();
                    }}
                >
                {mobileMenuOpen ? <X /> : <Menu />}
                </button>
            </div>
          </header>

          {/* Mobile Nav Overlay */}
          {mobileMenuOpen && (
            <div className="md:hidden absolute top-16 left-0 right-0 bg-matrix-bg border-b border-matrix-text z-50 p-4 flex flex-col gap-2 shadow-lg shadow-green-900/20">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => {
                      setMobileMenuOpen(false);
                      terminalAudio.playClick();
                  }}
                  className={`
                    p-3 flex items-center gap-3 border
                    ${isActive(item.to) ? 'bg-matrix-dark border-matrix-text' : 'border-transparent text-matrix-dim'}
                  `}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          )}

          {/* Main Content Area */}
          <main className="flex-1 overflow-hidden relative">
            <Outlet />
          </main>

          {/* Footer / Status Line */}
          <footer className="flex-none h-6 bg-matrix-dark border-t border-matrix-dim flex items-center justify-between px-2 text-[10px] uppercase">
            <span className="flex items-center gap-2">
              <Activity className="w-3 h-3" />
              SYSTEM_READY
            </span>
            <span>ENC: ACTIVE // LATENCY: 24ms</span>
          </footer>

          {/* Screen Effects */}
          <div className="absolute inset-0 pointer-events-none scanlines z-50"></div>
          <div className="absolute inset-0 pointer-events-none crt-flicker z-40 bg-green-500/5 mix-blend-overlay"></div>
       </div>
    </div>
  );
};

// -- Router Setup --
const rootRoute = createRootRoute({
  component: RootComponent,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: ISSTracker,
});

const mapRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/map',
  component: MapView,
});

const crewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/crew',
  component: CrewManifest,
});

const routeTree = rootRoute.addChildren([indexRoute, mapRoute, crewRoute]);

const memoryHistory = createMemoryHistory({
  initialEntries: ['/'],
});

const router = createRouter({ 
  routeTree,
  history: memoryHistory,
} as any);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}