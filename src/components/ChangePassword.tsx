import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface ChangePasswordProps {
  onPasswordChanged: () => void;
  userEmail: string;
}

export default function ChangePassword({ onPasswordChanged, userEmail }: ChangePasswordProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
      data: { has_changed_password: true }
    });

    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
      setTimeout(() => {
        onPasswordChanged();
      }, 1200);
    }

    setLoading(false);
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      backgroundColor: '#f8fafc',
      padding: '20px'
    }}>
      <div style={{ 
        width: '100%', 
        maxWidth: '420px',
        backgroundColor: '#fff',
        borderRadius: '16px',
        padding: '48px 40px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#0A2540', margin: 0 }}>
            Welcome to Aussie Grid
          </h1>
          <p style={{ color: '#666', marginTop: '12px', fontSize: '15px' }}>
            Please set a new password to continue
          </p>
        </div>

        {success ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
            <h2 style={{ color: '#22C55E', margin: 0 }}>Password Updated</h2>
            <p style={{ color: '#666', marginTop: '12px' }}>Taking you to the dashboard...</p>
          </div>
        ) : (
          <form onSubmit={handleChangePassword}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '14px', color: '#555', marginBottom: '8px', fontWeight: 500 }}>
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                required
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  fontSize: '16px',
                  border: '1px solid #ddd',
                  borderRadius: '10px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: '28px' }}>
              <label style={{ display: 'block', fontSize: '14px', color: '#555', marginBottom: '8px', fontWeight: 500 }}>
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  fontSize: '16px',
                  border: '1px solid #ddd',
                  borderRadius: '10px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {error && (
              <div style={{ 
                backgroundColor: '#fef2f2', 
                color: '#dc2626', 
                padding: '12px 16px', 
                borderRadius: '8px', 
                marginBottom: '24px',
                fontSize: '14px'
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '16px',
                backgroundColor: loading ? '#86efac' : '#22C55E',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontSize: '16px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Updating Password...' : 'Set New Password'}
            </button>
          </form>
        )}

        <p style={{ 
          textAlign: 'center', 
          color: '#888', 
          fontSize: '13px', 
          marginTop: '32px',
          marginBottom: 0
        }}>
          {userEmail}
        </p>
      </div>
    </div>
  );
}