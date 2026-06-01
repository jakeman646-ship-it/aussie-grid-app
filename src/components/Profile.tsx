import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface ProfileProps {
  onBack: () => void;
  onSignOut: () => void;
}

export default function Profile({ onBack, onSignOut }: ProfileProps) {
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
      }
    };
    getUser();
  }, []);

  const handleChangePassword = () => {
    // For now we'll just alert. Later we can route to a proper change password screen.
    alert('Change password feature coming soon. For now, you can reset your password via the login screen.');
  };

  const handleSignOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    onSignOut();
  };

  return (
    <div style={{ maxWidth: '520px', margin: '40px auto', padding: '0 20px' }}>
      <button 
        onClick={onBack}
        style={{ 
          background: 'none', 
          border: 'none', 
          color: '#64748b', 
          cursor: 'pointer',
          marginBottom: '24px',
          fontSize: '15px'
        }}
      >
        ← Back to Dashboard
      </button>

      <h1 style={{ marginBottom: '8px' }}>Account</h1>
      <p style={{ color: '#64748b', marginBottom: '32px' }}>
        Manage your pilot account details.
      </p>

      {/* Account Info Card */}
      <div style={{ 
        background: 'white', 
        border: '1px solid #e2e8f0', 
        borderRadius: '12px', 
        padding: '24px',
        marginBottom: '24px'
      }}>
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '6px' }}>
            Email Address
          </div>
          <div style={{ fontSize: '18px', fontWeight: 500 }}>
            {userEmail || 'Loading...'}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '6px' }}>
            Account Type
          </div>
          <div style={{ fontSize: '18px', fontWeight: 500 }}>
            Pilot Participant
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <button
          onClick={handleChangePassword}
          style={{
            width: '100%',
            padding: '16px',
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            fontSize: '16px',
            fontWeight: 500,
            cursor: 'pointer'
          }}
        >
          Change Password
        </button>

        <button
          onClick={handleSignOut}
          disabled={loading}
          style={{
            width: '100%',
            padding: '16px',
            background: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontSize: '16px',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1
          }}
        >
          {loading ? 'Signing out...' : 'Sign Out'}
        </button>
      </div>

      <p style={{ 
        fontSize: '13px', 
        color: '#94a3b8', 
        textAlign: 'center', 
        marginTop: '32px' 
      }}>
        This is a pilot account. Thank you for helping us test Aussie Grid.
      </p>
    </div>
  );
}