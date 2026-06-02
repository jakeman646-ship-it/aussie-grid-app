interface HelpProps {
    onBack: () => void;
  }
  
  export default function Help({ onBack }: HelpProps) {
    return (
      <div style={{ maxWidth: '720px', margin: '40px auto', padding: '0 20px' }}>
        
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
  
        {/* Main Heading */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ 
            margin: 0, 
            fontSize: '32px', 
            fontWeight: 700,
            color: '#0f172a'
          }}>
            Help & Instructions
          </h1>
          <p style={{ 
            color: '#64748b', 
            marginTop: '8px',
            fontSize: '16px'
          }}>
            Everything you need to know about the Aussie Grid pilot.
          </p>
        </div>
  
        {/* Section 1: Read-Only Mode */}
        <div style={{ 
          background: 'white', 
          border: '1px solid #e2e8f0', 
          borderRadius: '12px', 
          padding: '28px', 
          marginBottom: '24px' 
        }}>
          <h3 style={{ 
            marginTop: 0, 
            marginBottom: '16px', 
            color: '#166534',
            fontSize: '20px'
          }}>
            What is Read-Only Mode?
          </h3>
          <p style={{ color: '#475569', lineHeight: 1.7, marginBottom: '12px' }}>
            During the pilot, we can only <strong>read data</strong> from your solar and battery system. 
            We cannot control your inverter, change settings, or discharge your battery without your permission.
          </p>
          <p style={{ color: '#475569', lineHeight: 1.7, margin: 0 }}>
            This keeps things simple and safe while we collect performance data to improve the app.
          </p>
        </div>
  
        {/* Section 2: How to Find Your Keys */}
        <div style={{ 
          background: 'white', 
          border: '1px solid #e2e8f0', 
          borderRadius: '12px', 
          padding: '28px', 
          marginBottom: '24px' 
        }}>
          <h3 style={{ 
            marginTop: 0, 
            marginBottom: '20px', 
            color: '#166534',
            fontSize: '20px'
          }}>
            How to Find Your Sungrow Keys
          </h3>
          
          <ol style={{ 
            paddingLeft: '22px', 
            lineHeight: '1.85', 
            color: '#334155',
            marginBottom: '16px'
          }}>
            <li>Log into the <strong>Sungrow iSolarCloud</strong> app or website</li>
            <li>Tap on your profile icon (usually top right)</li>
            <li>Go to <strong>Account Settings</strong> or <strong>Developer / API</strong> section</li>
            <li>Find and copy your <strong>App Key</strong> and <strong>Access Key</strong></li>
            <li>Paste them into the "Connect Sungrow" screen in this app</li>
          </ol>
  
          <p style={{ 
            fontSize: '14px', 
            color: '#64748b', 
            margin: 0 
          }}>
            Can’t find them? Just message <strong>Ben</strong> and he’ll walk you through it.
          </p>
        </div>
  
        {/* Section 3: What Data Are We Collecting? */}
        <div style={{ 
          background: 'white', 
          border: '1px solid #e2e8f0', 
          borderRadius: '12px', 
          padding: '28px', 
          marginBottom: '24px' 
        }}>
          <h3 style={{ 
            marginTop: 0, 
            marginBottom: '16px', 
            color: '#166534',
            fontSize: '20px'
          }}>
            What Data Are We Collecting?
          </h3>
          <ul style={{ 
            paddingLeft: '22px', 
            lineHeight: '1.85', 
            color: '#334155',
            marginBottom: '16px'
          }}>
            <li>Battery level and charging/discharging status</li>
            <li>Solar production (kW)</li>
            <li>Home energy consumption</li>
            <li>Energy exported to or imported from the grid</li>
          </ul>
          <p style={{ color: '#475569', margin: 0 }}>
            This data helps us understand how homes in Mackay use and share energy.
          </p>
        </div>
  
        {/* Section 4: Need Help? */}
        <div style={{ 
          background: '#f8fafc', 
          border: '1px solid #e2e8f0', 
          borderRadius: '12px', 
          padding: '28px' 
        }}>
          <h3 style={{ 
            marginTop: 0, 
            marginBottom: '12px', 
            color: '#166534',
            fontSize: '20px'
          }}>
            Need Help?
          </h3>
          <p style={{ color: '#475569', lineHeight: 1.7, marginBottom: '8px' }}>
            If you have any questions or run into issues, just message <strong>Ben</strong> directly.
          </p>
          <p style={{ color: '#475569', margin: 0 }}>
            We’re here to support you through the pilot.
          </p>
        </div>
      </div>
    );
  }