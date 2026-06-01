import { useState } from 'react';

interface ConnectSungrowProps {
  onConnectSuccess: () => void;
  onBack: () => void;
}

export default function ConnectSungrow({ onConnectSuccess, onBack }: ConnectSungrowProps) {
  const [appKey, setAppKey] = useState('');
  const [accessKey, setAccessKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleConnect = async () => {
    if (!appKey.trim() || !accessKey.trim()) {
      setError('Please enter both your App Key and Access Key');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await new Promise(resolve => setTimeout(resolve, 1100));

      localStorage.setItem('sungrowAppKey', appKey.trim());
      localStorage.setItem('sungrowAccessKey', accessKey.trim());

      setSuccess(true);

      setTimeout(() => {
        onConnectSuccess();
      }, 1500);
    } catch (err) {
      setError('Connection failed. Please double-check your keys and try again.');
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={{ maxWidth: '520px', margin: '80px auto', padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '72px', marginBottom: '20px' }}>✅</div>
        <h2 style={{ marginBottom: '16px' }}>Successfully Connected</h2>
        <p style={{ color: '#475569', fontSize: '17px', lineHeight: 1.6 }}>
          Your Sungrow system is now linked in read-only mode.<br />
          We’ll start pulling performance data shortly.
        </p>
        <p style={{ color: '#64748b', fontSize: '15px', marginTop: '24px' }}>
          You can now return to the dashboard to monitor your system.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '580px', margin: '40px auto', padding: '0 20px' }}>
      <button 
        onClick={onBack}
        style={{ 
          background: 'none', 
          border: 'none', 
          color: '#64748b', 
          cursor: 'pointer',
          marginBottom: '20px',
          fontSize: '15px'
        }}
      >
        ← Back to Dashboard
      </button>

      <h1 style={{ marginBottom: '8px', fontSize: '28px' }}>Connect Your Sungrow System</h1>
      <p style={{ color: '#475569', fontSize: '16px', marginBottom: '28px' }}>
        We only need read-only access to collect performance data for the pilot. 
        We cannot control or change anything on your system.
      </p>

      {/* Instructions Box */}
      <div style={{ 
        background: '#f8fafc', 
        border: '1px solid #e2e8f0', 
        borderRadius: '12px', 
        padding: '24px', 
        marginBottom: '28px' 
      }}>
        <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px' }}>Where to find your keys</h3>
        
        <ol style={{ paddingLeft: '22px', lineHeight: '1.75', color: '#334155', marginBottom: '16px' }}>
          <li>Log into the <strong>Sungrow iSolarCloud</strong> portal</li>
          <li>Click on your profile (top right) → <strong>Account Settings</strong></li>
          <li>Go to the <strong>API</strong> or <strong>Developer</strong> tab</li>
          <li>Copy your <strong>App Key</strong> and <strong>Access Key</strong></li>
        </ol>

        <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
          Don’t worry if you can’t find them — we can jump on a quick call and I’ll walk you through it.
        </p>
      </div>

      {/* Form */}
      <div style={{ 
        background: 'white', 
        border: '1px solid #e2e8f0', 
        borderRadius: '12px', 
        padding: '32px' 
      }}>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>App Key <span style={{ color: '#ef4444' }}>*</span></label>
          <input
            type="text"
            value={appKey}
            onChange={(e) => setAppKey(e.target.value)}
            placeholder="Paste your App Key here"
            style={{
              width: '100%',
              padding: '14px 16px',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '16px'
            }}
          />
        </div>

        <div style={{ marginBottom: '28px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>Access Key <span style={{ color: '#ef4444' }}>*</span></label>
          <input
            type="text"
            value={accessKey}
            onChange={(e) => setAccessKey(e.target.value)}
            placeholder="Paste your Access Key here"
            style={{
              width: '100%',
              padding: '14px 16px',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '16px'
            }}
          />
        </div>

        {error && (
          <div style={{ 
            background: '#fef2f2', 
            color: '#b91c1c', 
            padding: '12px 16px', 
            borderRadius: '8px', 
            marginBottom: '20px',
            fontSize: '15px'
          }}>
            {error}
          </div>
        )}

        <button
          onClick={handleConnect}
          disabled={loading}
          style={{
            width: '100%',
            padding: '16px',
            background: loading ? '#94a3b8' : '#22c55e',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '17px',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Connecting to Sungrow...' : 'Connect Sungrow System'}
        </button>

        <p style={{ 
          fontSize: '14px', 
          color: '#64748b', 
          textAlign: 'center', 
          marginTop: '20px', 
          marginBottom: 0 
        }}>
          This is read-only access only. We will never control your inverter.
        </p>
      </div>
    </div>
  );
}