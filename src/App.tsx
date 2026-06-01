import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import ConnectSungrow from './components/ConnectSungrow';
import ChangePassword from './components/ChangePassword';
import Profile from './components/Profile';

type View = 'login' | 'change-password' | 'dashboard' | 'connect-sungrow' | 'profile';

export default function App() {
  const [view, setView] = useState<View>('login');
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        setView('dashboard');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        setView('dashboard');
      } else {
        setView('login');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setView('login');
  };

  if (!session && view !== 'login') {
    return <Login />;
  }

  return (
    <div>
      {view === 'login' && <Login />}
      
      {view === 'change-password' && (
        <ChangePassword 
          onPasswordChanged={() => setView('dashboard')} 
        />
      )}
      
      {view === 'dashboard' && (
        <Dashboard 
          onConnectInverter={() => setView('connect-sungrow')}
          onOpenProfile={() => setView('profile')}
          onSignOut={handleSignOut}
        />
      )}
      
      {view === 'connect-sungrow' && (
        <ConnectSungrow 
          onConnectSuccess={() => setView('dashboard')}
          onBack={() => setView('dashboard')}
        />
      )}

      {view === 'profile' && (
        <Profile 
          onBack={() => setView('dashboard')}
          onSignOut={handleSignOut}
        />
      )}
    </div>
  );
}