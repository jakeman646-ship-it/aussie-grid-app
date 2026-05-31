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
      setError('Please enter both App Key and Access Key');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await new Promise(resolve => setTimeout(resolve, 800));

      localStorage.setItem('sungrowAppKey', appKey.trim());
      localStorage.setItem('sungrowAccessKey', accessKey.trim());

      setSuccess(true);

      setTimeout(() => {
        onConnectSuccess();
      }, 1200);

    } catch (err) {
      setError('Failed to connect. Please check your keys and try again.');
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '40px', maxWidth: '520px', margin: '0 auto' }}>
      <button 
        onClick={onBack} 
        style={{ 
          background: 'none', 
          border: 'none', 
          color: '#666', 
          cursor: 'pointer',
          marginBottom: '24px',
          fontSize: '14px'
        }}
      >
        ← Back to Dashboard
      </button>

      <h2 style={{ marginBottom: '8px' }}>Connect Sungrow Inverter</h2>
      <p style={{ color: '#666', marginBottom: '32px' }}>
        Enter your iSolarCloud API credentials to enable live data.
      </p>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '14px', color: '#555', marginBottom: '6px' }}>
          App Key <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <input
          type="text"
          value={appKey}
          onChange={(e) => setAppKey(e.target.value)}
          placeholder="Paste your App Key here"
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '15px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            backgroundColor: loading ? '#f9fafb' : '#fff'
          }}
        />
      </div>

      <div style={{ marginBottom: '28px' }}>
        <label style={{ display: 'block', fontSize: '14px', color: '#555', marginBottom: '6px' }}>
          Access Key <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <input
          type="text"
          value={accessKey}
          onChange={(e) => setAccessKey(e.target.value)}
          placeholder="Paste your Access Key here"
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '15px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            backgroundColor: loading ? '#f9fafb' : '#fff'
          }}
        />
      </div>

      {error && (
        <div style={{ 
          backgroundColor: '#fef2f2', 
          color: '#dc2626', 
          padding: '12px 16px', 
          borderRadius: '8px', 
          marginBottom: '20px',
          fontSize: '14px'
        }}>
          {error}
        </div>
      )}

      <button
        onClick={handleConnect}
        disabled={loading || success}
        style={{
          width: '100%',
          padding: '16px',
          backgroundColor: loading || success ? '#86efac' : '#22C55E',
          color: 'white',
          border: 'none',
          borderRadius: '10px',
          fontSize: '16px',
          fontWeight: 600,
          cursor: loading || success ? 'not-allowed' : 'pointer'
        }}
      >
        {loading ? 'Connecting...' : success ? 'Connected Successfully ✓' : 'Connect Inverter'}
      </button>

      <p style={{ 
        textAlign: 'center', 
        color: '#888', 
        fontSize: '13px', 
        marginTop: '24px' 
      }}>
        This is currently read-only. We cannot control your system.
      </p>
    </div>
  );
}