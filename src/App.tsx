import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import ConnectSungrow from './components/ConnectSungrow';
import ChangePassword from './components/ChangePassword';

type View = 'login' | 'change-password' | 'dashboard' | 'connect-sungrow';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [currentView, setCurrentView] = useState<View>('login');
  const [hasInverterConnected, setHasInverterConnected] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        checkIfNeedsPasswordChange(session);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        checkIfNeedsPasswordChange(session);
      } else {
        setCurrentView('login');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkIfNeedsPasswordChange = (session: any) => {
    const hasChanged = session.user?.user_metadata?.has_changed_password === true;
    
    if (!hasChanged) {
      setCurrentView('change-password');
    } else {
      setCurrentView('dashboard');
    }

    // Load inverter connection status
    const saved = localStorage.getItem('hasInverterConnected');
    setHasInverterConnected(saved === 'true');
  };

  const handlePasswordChanged = () => {
    setCurrentView('dashboard');
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setCurrentView('login');
    setHasInverterConnected(false);
  };

  const handleConnectSuccess = () => {
    setHasInverterConnected(true);
    localStorage.setItem('hasInverterConnected', 'true');
    setCurrentView('dashboard');
  };

  if (!session) {
    return <Login />;
  }

  if (currentView === 'change-password') {
    return (
      <ChangePassword 
        onPasswordChanged={handlePasswordChanged} 
        userEmail={session.user?.email || ''} 
      />
    );
  }

  if (currentView === 'connect-sungrow') {
    return (
      <ConnectSungrow 
        onConnectSuccess={handleConnectSuccess}
        onBack={() => setCurrentView('dashboard')}
      />
    );
  }

  return (
    <Dashboard 
      userEmail={session.user?.email || ''} 
      onSignOut={handleSignOut}
      onConnectInverter={() => setCurrentView('connect-sungrow')}
      hasInverterConnected={hasInverterConnected}
    />
  );
}