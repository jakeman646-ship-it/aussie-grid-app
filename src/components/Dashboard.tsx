import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

type Mode = 'storm' | 'save' | 'sell' | 'holiday';

interface LiveStats {
  battery: number;
  solar: number;
  consumption: number;
  gridFlow: string;
  batteryTrend: 'charging' | 'discharging';
}

interface DashboardProps {
  onConnectInverter: () => void;
  onOpenProfile: () => void;
  onOpenHelp: () => void;
  onSignOut: () => void;
}

const modes = [
  { id: 'storm' as Mode, label: 'Storm Mode', color: '#0EA5E9', icon: '⚡' },
  { id: 'save' as Mode, label: 'Save Mode', color: '#22C55E', icon: '🌱' },
  { id: 'sell' as Mode, label: 'Sell Mode', color: '#F59E0B', icon: '💰' },
  { id: 'holiday' as Mode, label: 'Holiday Mode', color: '#8B5CF6', icon: '🏖️' },
];

export default function Dashboard({ 
  onConnectInverter, 
  onOpenProfile, 
  onOpenHelp, 
  onSignOut 
}: DashboardProps) {
  const [activeMode, setActiveMode] = useState<Mode>('storm');
  const [stats, setStats] = useState<LiveStats>({
    battery: 87,
    solar: 4.2,
    consumption: 1.1,
    gridFlow: 'Exporting',
    batteryTrend: 'discharging',
  });
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [dataSource, setDataSource] = useState<'simulated' | 'manual' | 'live'>('simulated');
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  // Get current user email
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) setUserEmail(user.email);
    };
    getUser();
  }, []);

  // Simulation loop
  useEffect(() => {
    const interval = setInterval(() => {
      setStats(prev => {
        const variation = (Math.random() - 0.5) * 0.4;
        const newSolar = Math.max(0.5, Math.min(6.5, prev.solar + variation));
        const newConsumption = Math.max(0.4, Math.min(2.8, prev.consumption + (Math.random() - 0.5) * 0.3));
        
        let newGridFlow = 'Standby';
        if (newSolar > newConsumption + 0.3) newGridFlow = 'Exporting';
        else if (newConsumption > newSolar + 0.3) newGridFlow = 'Importing';

        return {
          ...prev,
          solar: parseFloat(newSolar.toFixed(1)),
          consumption: parseFloat(newConsumption.toFixed(1)),
          gridFlow: newGridFlow,
        };
      });
      setLastUpdated(new Date());
    }, 4200);

    return () => clearInterval(interval);
  }, [activeMode]);

  const handleModeChange = (mode: Mode) => {
    setActiveMode(mode);
    setDataSource('simulated');
  };

  const avatarLetter = userEmail ? userEmail.charAt(0).toUpperCase() : '?';

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px' }}>
      
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '24px' 
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 600 }}>Aussie Grid</h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '15px' }}>Pilot Dashboard</p>
        </div>

        {/* Right side controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: '#64748b', fontSize: '14px' }}>{userEmail}</span>

          {/* Help Button */}
          <button
            onClick={onOpenHelp}
            style={{
              padding: '8px 16px',
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            ❓ Help
          </button>

          {/* User Avatar */}
          <div 
            onClick={onOpenProfile}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: '#0EA5E9',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 600,
              fontSize: '16px',
              cursor: 'pointer',
              userSelect: 'none'
            }}
            title="Account settings"
          >
            {avatarLetter}
          </div>

          <button 
            onClick={onSignOut}
            style={{
              padding: '8px 16px',
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Read-only Banner */}
      <div style={{
        background: '#fefce8',
        border: '1px solid #fde047',
        borderRadius: '8px',
        padding: '12px 16px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <span style={{ fontSize: '20px' }}>🔒</span>
        <div>
          <strong style={{ color: '#713f12' }}>Read-only mode</strong>
          <span style={{ color: '#713f12', marginLeft: '8px' }}>
            We are currently collecting performance data only. No control signals are being sent to your system.
          </span>
        </div>
      </div>

      {/* Stats Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ color: '#64748b', fontSize: '14px', marginBottom: '8px' }}>Battery Level</div>
          <div style={{ fontSize: '42px', fontWeight: 600, lineHeight: 1 }}>{stats.battery}<span style={{ fontSize: '24px' }}>%</span></div>
          <div style={{ color: stats.batteryTrend === 'charging' ? '#22c55e' : '#ef4444', fontSize: '14px', marginTop: '4px' }}>
            {stats.batteryTrend === 'charging' ? '↑ Charging' : '↓ Discharging'}
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ color: '#64748b', fontSize: '14px', marginBottom: '8px' }}>Solar Production</div>
          <div style={{ fontSize: '42px', fontWeight: 600, lineHeight: 1 }}>{stats.solar}<span style={{ fontSize: '24px' }}> kW</span></div>
        </div>

        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ color: '#64748b', fontSize: '14px', marginBottom: '8px' }}>Home Consumption</div>
          <div style={{ fontSize: '42px', fontWeight: 600, lineHeight: 1 }}>{stats.consumption}<span style={{ fontSize: '24px' }}> kW</span></div>
        </div>

        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ color: '#64748b', fontSize: '14px', marginBottom: '8px' }}>Grid Flow</div>
          <div style={{ fontSize: '28px', fontWeight: 600, color: '#22c55e' }}>{stats.gridFlow}</div>
          <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
            Last updated: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>

      {/* Operating Modes */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '16px' 
        }}>
          <h2 style={{ margin: 0, fontSize: '20px' }}>Operating Modes</h2>
          <span style={{ fontSize: '13px', color: '#64748b' }}>Tap to switch</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          {modes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => handleModeChange(mode.id)}
              style={{
                background: activeMode === mode.id ? mode.color : 'white',
                color: activeMode === mode.id ? 'white' : '#1e2937',
                border: activeMode === mode.id ? 'none' : '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '20px',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: activeMode === mode.id 
                  ? '0 4px 12px rgba(0,0,0,0.15)' 
                  : '0 1px 3px rgba(0,0,0,0.08)',
              }}
            >
              <div style={{ fontSize: '28px', marginBottom: '12px' }}>{mode.icon}</div>
              <div style={{ fontSize: '20px', fontWeight: 600 }}>{mode.label}</div>
              <div style={{ 
                fontSize: '14px', 
                opacity: activeMode === mode.id ? 0.9 : 0.6, 
                marginTop: '4px' 
              }}>
                {mode.id === 'storm' && 'Protect your battery during outages'}
                {mode.id === 'save' && 'Maximise self-consumption'}
                {mode.id === 'sell' && 'Export to the grid when prices are high'}
                {mode.id === 'holiday' && 'Minimal usage while you\'re away'}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Data Source Info */}
      <div style={{ 
        background: '#f8fafc', 
        borderRadius: '8px', 
        padding: '12px 16px', 
        fontSize: '14px',
        color: '#64748b',
        marginBottom: '32px'
      }}>
        Data source: <strong>{dataSource}</strong> &nbsp;•&nbsp; 
        This is currently simulated data for testing purposes.
      </div>

      {/* Connect Your Real System - Clean Version */}
      <div style={{ 
        background: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px'
      }}>
        <h3 style={{ marginTop: 0, marginBottom: '8px', fontSize: '18px' }}>
          Ready to connect your real system?
        </h3>
        <p style={{ color: '#64748b', marginBottom: '20px', fontSize: '15px' }}>
          When Jack or Matty is ready, connect their Sungrow inverter to start collecting real data.
        </p>

        <button 
          onClick={onConnectInverter}
          style={{
            background: '#166534',
            color: 'white',
            border: 'none',
            padding: '14px 32px',
            borderRadius: '10px',
            fontSize: '16px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Connect Real Inverter (Sungrow)
        </button>

        {/* Manual Entry - Secondary Action */}
        <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #f1f5f9' }}>
          <button 
            onClick={() => setShowManualEntry(!showManualEntry)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              fontSize: '14px',
              cursor: 'pointer',
              padding: '4px 0'
            }}
          >
            {showManualEntry ? 'Hide manual data entry' : 'Or enter manual readings for testing →'}
          </button>
        </div>
      </div>
    </div>
  );
}