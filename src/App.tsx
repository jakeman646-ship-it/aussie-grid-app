import { useState } from 'react';
import Dashboard from './components/Dashboard';
import ConnectInverter from './components/ConnectInverter';
import Help from './components/Help';
import Profile from './components/Profile';
import ChangePassword from './components/ChangePassword';

type View = 'dashboard' | 'connect-inverter' | 'help' | 'profile' | 'change-password';

export default function App() {
  const [view, setView] = useState<View>('dashboard');
  const [currentUserId, setCurrentUserId] = useState<string>('sungrow-test-001');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = () => {
    setView('dashboard');
    setMobileMenuOpen(false);
  };

  const navigateTo = (newView: View) => {
    setView(newView);
    setMobileMenuOpen(false);
  };

  const handleConnectInverter = () => {
    setView('connect-inverter');
    setMobileMenuOpen(false);
  };

  const handleBackToDashboard = () => {
    setView('dashboard');
  };

  const handleSwitchHousehold = (newUserId: string) => {
    setCurrentUserId(newUserId);
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
            <button onClick={() => setView('dashboard')} className={navLinkClass(view === 'dashboard')}>
              Dashboard
            </button>
            <button onClick={() => setView('connect-inverter')} className={navLinkClass(view === 'connect-inverter')}>
              Connect Inverter
            </button>
            <button onClick={() => setView('help')} className={navLinkClass(view === 'help')}>
              Help
            </button>
            <button onClick={() => setView('profile')} className={navLinkClass(view === 'profile')}>
              Profile
            </button>
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-2">
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
        {view === 'dashboard' && (
          <Dashboard
            userId={currentUserId}
            onConnectInverter={handleConnectInverter}
            onOpenProfile={() => setView('profile')}
            onOpenHelp={() => setView('help')}
            onSignOut={handleSignOut}
            onSwitchHousehold={handleSwitchHousehold}
          />
        )}
        {view === 'connect-inverter' && (
          <ConnectInverter
            currentHouseholdId={currentUserId}
            onBack={handleBackToDashboard}
          />
        )}
        {view === 'help' && <Help onBack={() => setView('dashboard')} />}
        {view === 'profile' && (
          <Profile
            onBack={() => setView('dashboard')}
            onSignOut={handleSignOut}
            onChangePassword={() => setView('change-password')}
          />
        )}
        {view === 'change-password' && (
          <ChangePassword onPasswordChanged={() => setView('dashboard')} />
        )}
      </main>
    </div>
  );
}