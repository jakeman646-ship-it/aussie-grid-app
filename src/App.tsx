/**
 * Aussie Grid — App shell
 * File: src/App.tsx
 * Version: v0.1.2.17
 * Lines: 247
 */
import { Component, Suspense, useState, useTransition, type ReactNode } from 'react';
import { lazyWithReload } from './lib/lazyRetry';
import { getCurrentHouseholdId, setCurrentHouseholdId } from './lib/currentHousehold';

const Dashboard = lazyWithReload(() => import('./components/Dashboard'));
const ConnectInverter = lazyWithReload(() => import('./components/ConnectInverter'));
const Help = lazyWithReload(() => import('./components/Help'));
const Profile = lazyWithReload(() => import('./components/Profile'));
const ChangePassword = lazyWithReload(() => import('./components/ChangePassword'));

function ViewLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-slate-400">
      Loading…
    </div>
  );
}

interface ViewErrorBoundaryProps {
  /** Changes when the user navigates; clears a previous view's error. */
  resetKey: string;
  children: ReactNode;
}

interface ViewErrorBoundaryState {
  hasError: boolean;
  errorKey: string | null;
}

class ViewErrorBoundary extends Component<ViewErrorBoundaryProps, ViewErrorBoundaryState> {
  state: ViewErrorBoundaryState = { hasError: false, errorKey: null };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    this.setState({ errorKey: this.props.resetKey });
  }

  componentDidUpdate(prevProps: ViewErrorBoundaryProps) {
    // Navigating to a different view must never stay frozen on a stale error.
    if (this.state.hasError && this.props.resetKey !== prevProps.resetKey) {
      this.setState({ hasError: false, errorKey: null });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-slate-300">
          <p>Something went wrong loading this page.</p>
          <div className="flex gap-3">
            <button
              onClick={() => this.setState({ hasError: false, errorKey: null })}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
            >
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="rounded-md border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

type View = 'dashboard' | 'connect-inverter' | 'help' | 'profile' | 'change-password';

export default function App() {
  const [view, setView] = useState<View>('dashboard');
  const [currentUserId, setCurrentUserId] = useState<string>(() => getCurrentHouseholdId());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Bumped to tell the Dashboard to refetch its data in place. This must NOT
  // be used as a React key: remounting the Dashboard threw away all loaded
  // data and pinned returning users on the full-screen loading state.
  const [dashboardRefresh, setDashboardRefresh] = useState(0);
  const [isNavigating, startNavigation] = useTransition();

  // Transition-based navigation keeps the current page visible and the nav
  // clickable while the next view's chunk loads, instead of swapping the whole
  // main area for a Suspense fallback that can appear frozen on slow networks.
  const navigateTo = (newView: View) => {
    setMobileMenuOpen(false);
    if (newView === view) return;
    startNavigation(() => {
      setView(newView);
    });
  };

  const handleSignOut = () => {
    navigateTo('dashboard');
  };

  const handleConnectInverter = () => {
    navigateTo('connect-inverter');
  };

  const handleBackToDashboard = () => {
    navigateTo('dashboard');
  };

  const handleConnectionComplete = () => {
    setDashboardRefresh((k) => k + 1);
  };

  const handleSwitchHousehold = (newUserId: string) => {
    setCurrentHouseholdId(newUserId);
    setCurrentUserId(newUserId);
    setDashboardRefresh((k) => k + 1);
  };

  const navLinkClass = (active: boolean) =>
    `px-4 py-2 rounded-md text-sm font-medium transition-colors ${
      active
        ? 'bg-emerald-600 text-white'
        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
    }`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Top Navigation */}
      <nav className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6">
          {/* Logo + Brand */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-base font-bold text-white">
              AG
            </div>
            <div className="hidden sm:block">
              <div className="font-semibold text-emerald-400">Aussie Grid</div>
              <div className="text-[10px] text-slate-500 -mt-1">Mackay Pilot</div>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            <button onClick={() => navigateTo('dashboard')} className={navLinkClass(view === 'dashboard')}>
              Dashboard
            </button>
            <button onClick={() => navigateTo('connect-inverter')} className={navLinkClass(view === 'connect-inverter')}>
              Connect Inverter
            </button>
            <button onClick={() => navigateTo('help')} className={navLinkClass(view === 'help')}>
              Help
            </button>
            <button onClick={() => navigateTo('profile')} className={navLinkClass(view === 'profile')}>
              Profile
            </button>
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-2">
            {isNavigating && (
              <span
                aria-hidden
                className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500/40 border-t-emerald-400"
              />
            )}
            <button
              onClick={handleSignOut}
              className="hidden md:block rounded-md border border-red-600/60 px-3 py-1.5 text-sm text-red-400 hover:bg-red-950/40"
            >
              Sign out
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? 'Close' : 'Menu'}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-800 bg-slate-950 px-4 py-3">
            <div className="flex flex-col gap-1">
              <button onClick={() => navigateTo('dashboard')} className={`w-full text-left px-4 py-2.5 rounded-md text-sm ${view === 'dashboard' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>Dashboard</button>
              <button onClick={() => navigateTo('connect-inverter')} className={`w-full text-left px-4 py-2.5 rounded-md text-sm ${view === 'connect-inverter' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>Connect Inverter</button>
              <button onClick={() => navigateTo('help')} className={`w-full text-left px-4 py-2.5 rounded-md text-sm ${view === 'help' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>Help</button>
              <button onClick={() => navigateTo('profile')} className={`w-full text-left px-4 py-2.5 rounded-md text-sm ${view === 'profile' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>Profile</button>
              <div className="pt-2 mt-2 border-t border-slate-800">
                <button onClick={handleSignOut} className="w-full text-left px-4 py-2.5 rounded-md text-sm text-red-400 hover:bg-red-950/40">Sign out</button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Page Content */}
      <main>
        <ViewErrorBoundary resetKey={view}>
          <Suspense fallback={<ViewLoading />}>
            {/* The Dashboard stays mounted and is only hidden while other
                views are open. Unmounting it on navigation discarded all
                loaded data, so every return froze on the loading state while
                each query started over. */}
            <div className={view === 'dashboard' ? undefined : 'hidden'}>
              <Dashboard
                refreshKey={dashboardRefresh}
                userId={currentUserId}
                onConnectInverter={handleConnectInverter}
                onOpenProfile={() => navigateTo('profile')}
                onOpenHelp={() => navigateTo('help')}
                onSignOut={handleSignOut}
                onSwitchHousehold={handleSwitchHousehold}
              />
            </div>
            {view === 'connect-inverter' && (
              <ConnectInverter
                currentHouseholdId={currentUserId}
                onBack={handleBackToDashboard}
                onConnectionComplete={handleConnectionComplete}
              />
            )}
            {view === 'help' && <Help onBack={handleBackToDashboard} />}
            {view === 'profile' && (
              <Profile
                onBack={handleBackToDashboard}
                onSignOut={handleSignOut}
                onChangePassword={() => navigateTo('change-password')}
              />
            )}
            {view === 'change-password' && (
              <ChangePassword onPasswordChanged={handleBackToDashboard} />
            )}
          </Suspense>
        </ViewErrorBoundary>
      </main>
    </div>
  );
}
