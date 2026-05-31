import { useState, useEffect } from 'react';

interface DashboardProps {
  userEmail: string;
  onSignOut: () => void;
  onConnectInverter: () => void;
  hasInverterConnected: boolean;
}

interface LiveStats {
  battery: number;
  solar: number;
  consumption: number;
  gridFlow: string;
  batteryTrend: string;
}

type DataSource = 'simulated' | 'manual' | 'live';

const modes = [
  { 
    id: 'storm', 
    name: 'Storm Mode', 
    description: 'Protect your battery and home during storms or outages', 
    color: '#1e40af',
    icon: '⚡'
  },
  { 
    id: 'save', 
    name: 'Save Mode', 
    description: 'Maximise self-consumption and cut your electricity bill', 
    color: '#166534',
    icon: '💰'
  },
  { 
    id: 'sell', 
    name: 'Sell Mode', 
    description: 'Export excess energy to the grid for maximum return', 
    color: '#b45309',
    icon: '📈'
  },
  { 
    id: 'holiday', 
    name: 'Holiday Mode', 
    description: 'Minimise usage while you\'re away', 
    color: '#4338ca',
    icon: '🏖️'
  },
];

export default function Dashboard({ 
  userEmail, 
  onSignOut, 
  onConnectInverter, 
  hasInverterConnected 
}: DashboardProps) {
  const [activeMode, setActiveMode] = useState<'storm' | 'save' | 'sell' | 'holiday'>('storm');
  const [stats, setStats] = useState<LiveStats>({
    battery: 87,
    solar: 4.2,
    consumption: 1.1,
    gridFlow: 'Exporting',
    batteryTrend: 'charging',
  });
  const [isManual, setIsManual] = useState(false);
  const [manualBattery, setManualBattery] = useState('');
  const [manualSolar, setManualSolar] = useState('');
  const [manualConsumption, setManualConsumption] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [dataSource, setDataSource] = useState<DataSource>('simulated');

  // Load saved mode
  useEffect(() => {
    const savedMode = localStorage.getItem('activeMode');
    if (savedMode) {
      setActiveMode(savedMode as any);
    }
  }, []);

  // Save mode when it changes
  useEffect(() => {
    localStorage.setItem('activeMode', activeMode);
  }, [activeMode]);

  // Simulation engine (only runs when NOT in manual mode)
  useEffect(() => {
    if (isManual) return;

    const interval = setInterval(() => {
      setStats(prev => {
        let newBattery = prev.battery;
        let newSolar = prev.solar;
        let newConsumption = prev.consumption;

        // Mode-specific behaviour
        if (activeMode === 'storm') {
          newBattery = Math.max(75, Math.min(95, newBattery + (Math.random() - 0.3) * 0.8));
          newSolar = Math.max(0.5, Math.min(6, newSolar + (Math.random() - 0.5) * 0.4));
          newConsumption = Math.max(0.4, Math.min(1.8, newConsumption + (Math.random() - 0.5) * 0.2));
        } else if (activeMode === 'save') {
          newBattery = Math.max(60, Math.min(90, newBattery + (Math.random() - 0.4) * 1.2));
          newSolar = Math.max(1, Math.min(7, newSolar + (Math.random() - 0.5) * 0.6));
          newConsumption = Math.max(0.8, Math.min(2.5, newConsumption + (Math.random() - 0.5) * 0.3));
        } else if (activeMode === 'sell') {
          newBattery = Math.max(40, Math.min(80, newBattery - (Math.random() * 0.8)));
          newSolar = Math.max(2, Math.min(8, newSolar + (Math.random() - 0.3) * 0.7));
          newConsumption = Math.max(1, Math.min(3, newConsumption + (Math.random() - 0.5) * 0.4));
        } else if (activeMode === 'holiday') {
          newBattery = Math.max(70, Math.min(95, newBattery + (Math.random() - 0.5) * 0.5));
          newSolar = Math.max(0.3, Math.min(4, newSolar + (Math.random() - 0.5) * 0.3));
          newConsumption = Math.max(0.2, Math.min(0.9, newConsumption + (Math.random() - 0.5) * 0.15));
        }

        const newGridFlow = newSolar > newConsumption ? 'Exporting' : 'Importing';

        return {
          battery: Math.round(newBattery * 10) / 10,
          solar: Math.round(newSolar * 10) / 10,
          consumption: Math.round(newConsumption * 10) / 10,
          gridFlow: newGridFlow,
          batteryTrend: newBattery > prev.battery ? 'charging' : 'discharging',
        };
      });
    }, 4200);

    return () => clearInterval(interval);
  }, [activeMode, isManual]);

  
  const handleModeClick = (modeId: 'storm' | 'save' | 'sell' | 'holiday') => {
    setActiveMode(modeId);
  };

  // Apply manual data
  const applyManualData = () => {
    const battery = parseFloat(manualBattery);
    const solar = parseFloat(manualSolar);
    const consumption = parseFloat(manualConsumption);

    if (isNaN(battery) || isNaN(solar) || isNaN(consumption)) {
      alert('Please enter valid numbers for all fields.');
      return;
    }

    const gridFlow = solar > consumption ? 'Exporting' : 'Importing';
    const batteryTrend = battery > stats.battery ? 'charging' : 'discharging';

    setStats({
      battery: Math.round(battery * 10) / 10,
      solar: Math.round(solar * 10) / 10,
      consumption: Math.round(consumption * 10) / 10,
      gridFlow,
      batteryTrend,
    });

    setIsManual(true);
    setDataSource('manual');
    setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    setShowSuccess(true);

    setTimeout(() => setShowSuccess(false), 2500);
  };

  // Reset back to simulation
  const resetToSimulation = () => {
    setIsManual(false);
    setDataSource('simulated');
    setManualBattery('');
    setManualSolar('');
    setManualConsumption('');
    setLastUpdated('');
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto', fontFamily: 'system-ui' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '28px', color: '#0A2540' }}>Aussie Grid</h1>
          <p style={{ margin: '4px 0 0', color: '#666' }}>Pilot Testing Dashboard — Using simulated data + manual entry</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: '#666', fontSize: '14px' }}>{userEmail}</span>
          <button 
            onClick={onSignOut}
            style={{ 
              padding: '8px 16px', 
              backgroundColor: '#f1f5f9', 
              border: 'none', 
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Mode Selection */}
      <h2 style={{ marginBottom: '16px', color: '#0A2540' }}>Select Operating Mode</h2>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
        gap: '16px',
        marginBottom: '40px'
      }}>
        {modes.map((mode) => (
          <div
            key={mode.id}
            onClick={() => handleModeClick(mode.id as any)}
            style={{
              border: activeMode === mode.id ? `2px solid ${mode.color}` : '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '20px',
              cursor: 'pointer',
              backgroundColor: activeMode === mode.id ? '#f8fafc' : '#fff',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ fontSize: '28px', marginBottom: '12px' }}>{mode.icon}</div>
            <h3 style={{ margin: '0 0 8px', color: mode.color }}>{mode.name}</h3>
            <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>{mode.description}</p>
            
            {activeMode === mode.id && (
              <div style={{ 
                marginTop: '12px', 
                backgroundColor: mode.color, 
                color: 'white', 
                display: 'inline-block',
                padding: '4px 12px',
                borderRadius: '9999px',
                fontSize: '12px',
                fontWeight: 600
              }}>
                ACTIVE
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Live Status Section */}
      <div style={{ 
        backgroundColor: '#fff', 
        border: '1px solid #e2e8f0', 
        borderRadius: '16px', 
        padding: '24px',
        marginBottom: '32px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, color: '#0A2540' }}>Live Status</h2>
          
          {/* Data Source Indicator */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            borderRadius: '9999px',
            fontSize: '13px',
            fontWeight: 600,
            backgroundColor: 
              dataSource === 'live' ? '#dcfce7' : 
              dataSource === 'manual' ? '#fef3c7' : '#e0e7ff',
            color: 
              dataSource === 'live' ? '#166534' : 
              dataSource === 'manual' ? '#92400e' : '#3730a3'
          }}>
            {dataSource === 'live' && '🟢 Live from Inverter'}
            {dataSource === 'manual' && '✏️ Manual Entry'}
            {dataSource === 'simulated' && '🔄 Simulated Data'}
          </div>
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', 
          gap: '16px' 
        }}>
          <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '12px' }}>
            <div style={{ color: '#64748b', fontSize: '13px', marginBottom: '4px' }}>Battery</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#0A2540' }}>
              {stats.battery}%
            </div>
            <div style={{ fontSize: '13px', color: stats.batteryTrend === 'charging' ? '#16a34a' : '#dc2626' }}>
              {stats.batteryTrend === 'charging' ? '↑ Charging' : '↓ Discharging'}
            </div>
          </div>

          <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '12px' }}>
            <div style={{ color: '#64748b', fontSize: '13px', marginBottom: '4px' }}>Solar Production</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#0A2540' }}>
              {stats.solar} kW
            </div>
          </div>

          <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '12px' }}>
            <div style={{ color: '#64748b', fontSize: '13px', marginBottom: '4px' }}>Home Consumption</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#0A2540' }}>
              {stats.consumption} kW
            </div>
          </div>

          <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '12px' }}>
            <div style={{ color: '#64748b', fontSize: '13px', marginBottom: '4px' }}>Grid Flow</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#16a34a' }}>
              {stats.gridFlow}
            </div>
          </div>
        </div>

        {lastUpdated && (
          <p style={{ fontSize: '12px', color: '#888', marginTop: '12px', textAlign: 'right' }}>
            Last updated: {lastUpdated}
          </p>
        )}
      </div>

      {/* Manual Entry Section */}
      <div style={{ 
        backgroundColor: '#fff', 
        border: '1px solid #e2e8f0', 
        borderRadius: '16px', 
        padding: '24px',
        marginBottom: '40px'
      }}>
        <h3 style={{ marginTop: 0, color: '#0A2540' }}>Manual Data Entry (for testing)</h3>
        <p style={{ color: '#666', marginBottom: '20px' }}>
          Enter real numbers from your inverter to test the dashboard.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={{ fontSize: '13px', color: '#555', display: 'block', marginBottom: '6px' }}>Battery %</label>
            <input 
              type="number" 
              value={manualBattery} 
              onChange={(e) => setManualBattery(e.target.value)}
              placeholder="87"
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '13px', color: '#555', display: 'block', marginBottom: '6px' }}>Solar (kW)</label>
            <input 
              type="number" 
              step="0.1"
              value={manualSolar} 
              onChange={(e) => setManualSolar(e.target.value)}
              placeholder="4.2"
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '13px', color: '#555', display: 'block', marginBottom: '6px' }}>Consumption (kW)</label>
            <input 
              type="number" 
              step="0.1"
              value={manualConsumption} 
              onChange={(e) => setManualConsumption(e.target.value)}
              placeholder="1.1"
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button 
            onClick={applyManualData}
            style={{ 
              backgroundColor: '#22C55E', 
              color: 'white', 
              border: 'none', 
              padding: '12px 24px', 
              borderRadius: '10px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Apply Manual Data
          </button>

          {isManual && (
            <button 
              onClick={resetToSimulation}
              style={{ 
                backgroundColor: '#f1f5f9', 
                color: '#334155', 
                border: 'none', 
                padding: '12px 20px', 
                borderRadius: '10px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              Reset to Simulation
            </button>
          )}
        </div>

        {showSuccess && (
          <div style={{ 
            marginTop: '16px', 
            backgroundColor: '#dcfce7', 
            color: '#166534', 
            padding: '10px 16px', 
            borderRadius: '8px',
            fontSize: '14px'
          }}>
            ✅ Manual data applied successfully
          </div>
        )}
      </div>

      {/* Connect Inverter Button */}
      {!hasInverterConnected && (
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button 
            onClick={onConnectInverter}
            style={{
              backgroundColor: '#0A2540',
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
          <p style={{ fontSize: '13px', color: '#888', marginTop: '8px' }}>
            Ready to connect Jack or Matty’s system? Click above.
          </p>
        </div>
      )}
    </div>
  );
}