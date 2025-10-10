import React, { useState, useEffect } from 'react';
import { debugEmailVerificationStatus, checkAndSyncEmailVerification } from '../utils/emailVerification';
import { getAuth, sendEmailVerification } from 'firebase/auth';
import { diagnoseEmailConfiguration } from '../utils/emailDiagnostics';

function EmailVerificationDebug() {
  const [debugInfo, setDebugInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleDebugCheck = async () => {
    setLoading(true);
    const info = await debugEmailVerificationStatus();
    setDebugInfo(info);
    setLoading(false);
  };

  const handleSyncCheck = async () => {
    setLoading(true);
    const result = await checkAndSyncEmailVerification();
    setDebugInfo({ ...debugInfo, syncResult: result, lastSyncAt: new Date().toISOString() });
    setLoading(false);
  };

  return (
    <div style={{ 
      position: 'fixed', 
      top: '10px', 
      right: '10px', 
      background: 'white', 
      border: '2px solid #007B7F', 
      padding: '1rem', 
      borderRadius: '8px',
      maxWidth: '400px',
      zIndex: 9999
    }}>
      <h4>Email Verification Debug</h4>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <button 
          onClick={handleDebugCheck} 
          disabled={loading}
          style={{ padding: '0.5rem', background: '#007B7F', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          {loading ? 'Checking...' : 'Check Status'}
        </button>
        <button 
          onClick={handleSyncCheck} 
          disabled={loading}
          style={{ padding: '0.5rem', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          Sync Now
        </button>
      </div>
      {debugInfo && (
        <div style={{ fontSize: '0.8rem', lineHeight: '1.4' }}>
          <pre style={{ background: '#f5f5f5', padding: '0.5rem', borderRadius: '4px', overflow: 'auto' }}>
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default EmailVerificationDebug;