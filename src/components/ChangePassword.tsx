import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface ChangePasswordProps {
  onPasswordChanged: () => void;
}

export default function ChangePassword({ onPasswordChanged }: ChangePasswordProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
        data: { has_changed_password: true }
      });

      if (error) throw error;

      setSuccess(true);

      // Wait a moment then redirect to dashboard
      setTimeout(() => {
        onPasswordChanged();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to update password. Please try again.');
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={{ 
        maxWidth: '420px', 
        margin: '80px auto', 
        padding: '40px', 
        textAlign: 'center',
        background: 'white',
        borderRadius: '16px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
      }}>
        <div style={{ fontSize: '64px', marginBottom: '20px' }}>✅</div>
        <h2 style={{ marginBottom: '12px' }}>Password Updated</h2>
        <p style={{ color: '#64748b', fontSize: '16px' }}>
          Your password has been changed successfully.<br />
          Taking you to the dashboard...
        </p>
      </div>
    );
  }

  return (
    <div style={{ 
      maxWidth: '420px', 
      margin: '60px auto', 
      padding: '0 20px' 
    }}>
      <div style={{ 
        background: 'white', 
        padding: '40px', 
        borderRadius: '16px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
      }}>
        <h1 style={{ marginBottom: '8px', textAlign: 'center' }}>Create New Password</h1>
        <p style={{ 
          color: '#64748b', 
          textAlign: 'center', 
          marginBottom: '32px',
          fontSize: '15px'
        }}>
          Please set a new password for your pilot account.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
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
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                fontSize: '16px'
              }}
            />
          </div>

          <div style={{ marginBottom: '28px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
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
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
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
              background: loading ? '#94a3b8' : '#22c55e',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '17px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Updating Password...' : 'Set New Password'}
          </button>
        </form>

        <p style={{ 
          fontSize: '13px', 
          color: '#94a3b8', 
          textAlign: 'center', 
          marginTop: '24px' 
        }}>
          Your password must be at least 8 characters long.
        </p>
      </div>
    </div>
  );
}