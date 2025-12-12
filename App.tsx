import React from 'react';
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
import { Globe, Map as MapIcon, Users, Terminal, Activity, Menu, X } from 'lucide-react';
import { ISSTracker } from './routes/Dashboard'; // Direct import for main route
import { CrewManifest } from './routes/Crew';
import { MapView } from './routes/MapRoute';

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
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const location = useLocation();

  const navItems = [
    { to: '/', label: '3D_GLOBE', icon: Globe },
    { to: '/map', label: '2D_MAP', icon: MapIcon },
    { to: '/crew', label: 'CREW_MANIFEST', icon: Users },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="flex flex-col h-screen w-full bg-matrix-bg text-matrix-text font-mono overflow-hidden crt-flicker">
      {/* Header */}
      <header className="flex-none h-16 border-b border-matrix-dim flex items-center justify-between px-4 z-40 bg-matrix-bg/90 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Terminal className="w-6 h-6 animate-pulse" />
          <div>
            <h1 className="text-xl font-bold tracking-widest uppercase drop-shadow-[0_0_5px_rgba(0,255,65,0.8)]">
              ISS_TRACKER
            </h1>
            <div className="flex items-center gap-2 text-[10px] text-matrix-dim">
              <span className="w-2 h-2 rounded-full bg-matrix-text animate-pulse-fast"></span>
              <span>LIVE_FEED__CONNECTED</span>
            </div>
          </div>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
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

        {/* Mobile Menu Toggle */}
        <button
          className="md:hidden p-2 text-matrix-text border border-matrix-dim"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X /> : <Menu />}
        </button>
      </header>

      {/* Mobile Nav Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-16 left-0 right-0 bg-matrix-bg border-b border-matrix-text z-50 p-4 flex flex-col gap-2">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMobileMenuOpen(false)}
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

// Use memory history to avoid pushState errors in sandboxed environments (like iframes/blobs)
const memoryHistory = createMemoryHistory({
  initialEntries: ['/'],
});

const router = createRouter({ 
  routeTree,
  history: memoryHistory,
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}