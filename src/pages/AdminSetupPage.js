import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, deleteUser } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, addDoc, query, where, getDocs, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

function AdminSetupPage() {
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: 'Admin User',
    verificationCode: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [step, setStep] = useState('verify'); // 'verify', 'create', 'code'
  const [generatedCode, setGeneratedCode] = useState('');

  // Cleanup function to delete unverified accounts older than 30 minutes
  const cleanupUnverifiedAccounts = async () => {
    try {
      const thirtyMinutesAgo = Timestamp.fromDate(new Date(Date.now() - 30 * 60 * 1000));
      
      // Query for unverified codes older than 30 minutes
      const q = query(
        collection(db, 'admin_verification_codes'),
        where('used', '==', false),
        where('createdAt', '<=', thirtyMinutesAgo)
      );
      
      const querySnapshot = await getDocs(q);
      
      for (const docSnapshot of querySnapshot.docs) {
        const data = docSnapshot.data();
        
        try {
          // Delete the Firebase Auth user if it exists
          const auth = getAuth();
          if (data.userId) {
            // Note: This requires admin privileges to delete other users
            // In a production environment, this should be done server-side
            console.log(`Would delete user ${data.userId} (expired unverified account)`);
          }
          
          // Delete the verification code document
          await deleteDoc(doc(db, 'admin_verification_codes', docSnapshot.id));
          console.log(`Deleted expired verification code for ${data.email}`);
          
        } catch (error) {
          console.error(`Error deleting expired account for ${data.email}:`, error);
        }
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  };

  // Run cleanup on component mount and set up periodic cleanup
  useEffect(() => {
    // Run cleanup immediately
    cleanupUnverifiedAccounts();
    
    // Set up periodic cleanup every 10 minutes
    const cleanupInterval = setInterval(cleanupUnverifiedAccounts, 10 * 60 * 1000);
    
    // Cleanup interval on unmount
    return () => clearInterval(cleanupInterval);
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleVerifyAdmin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const auth = getAuth();
      
      // Try to sign in first to check if account exists
      try {
        const userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);
        const user = userCredential.user;

        // Check if user is already an admin
        const adminDoc = await getDoc(doc(db, 'admins', user.uid));
        if (adminDoc.exists()) {
          setMessage('✅ Admin access already exists! Redirecting to dashboard...');
          setTimeout(() => navigate('/admin-dashboard'), 2000);
        } else {
          // Account exists but not admin, proceed to code verification
          setStep('code');
          setMessage('✅ Account found. Enter verification code to complete admin setup.');
        }
      } catch (authError) {
        if (authError.code === 'auth/user-not-found' || authError.code === 'auth/invalid-credential') {
          // Account doesn't exist, proceed to create it
          setStep('create');
          setMessage('✅ Ready to create admin account...');
        } else {
          throw authError;
        }
      }
    } catch (error) {
      setMessage('❌ Authentication failed: ' + error.message);
    }
    setLoading(false);
  };

  const handleCreateAccount = async () => {
    setLoading(true);
    setMessage('');

    // Validate form data
    if (!formData.email || !formData.password) {
      setMessage('❌ Please fill in both email and password');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setMessage('❌ Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    try {
      const auth = getAuth();
      console.log('Creating admin account with email:', formData.email);
      
      // Try to create the Firebase account
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        const user = userCredential.user;
        console.log('Admin account created successfully:', user.uid);

        // Generate a unique verification code
        const code = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        setGeneratedCode(code);

        // Store the verification code in Firestore
        await addDoc(collection(db, 'admin_verification_codes'), {
          code: code,
          userId: user.uid,
          email: formData.email,
          createdAt: Timestamp.now(),
          used: false
        });

        setMessage(`✅ Admin account created successfully! Check the Firestore 'admin_verification_codes' collection for your verification code.`);
        setStep('code');

      } catch (createError) {
        console.error('Account creation error:', createError);
        
        if (createError.code === 'auth/email-already-in-use') {
          // Email already exists, try to sign in instead
          console.log('Email exists, attempting sign in...');
          try {
            const userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);
            const user = userCredential.user;
            console.log('Signed in existing user:', user.uid);

            // Generate a unique verification code
            const code = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
            setGeneratedCode(code);

            // Store the verification code in Firestore
            await addDoc(collection(db, 'admin_verification_codes'), {
              code: code,
              userId: user.uid,
              email: formData.email,
              createdAt: Timestamp.now(),
              used: false
            });

            setMessage(`✅ Signed into existing account! Check the Firestore 'admin_verification_codes' collection for your verification code.`);
            setStep('code');
          } catch (signInError) {
            console.error('Sign in error:', signInError);
            if (signInError.code === 'auth/invalid-credential' || signInError.code === 'auth/wrong-password') {
              setMessage('❌ Email exists but password is incorrect. Please use the correct password.');
            } else {
              setMessage('❌ Error signing in: ' + signInError.message);
            }
          }
        } else if (createError.code === 'auth/weak-password') {
          setMessage('❌ Password is too weak. Please use at least 6 characters.');
        } else if (createError.code === 'auth/invalid-email') {
          setMessage('❌ Invalid email format. Please enter a valid email address.');
        } else if (createError.code === 'auth/operation-not-allowed') {
          setMessage('❌ Email/password authentication is not enabled. Please contact support.');
        } else {
          setMessage('❌ Account creation failed: ' + createError.message);
        }
      }

    } catch (error) {
      console.error('Unexpected error:', error);
      setMessage('❌ Unexpected error: ' + error.message);
    }
    setLoading(false);
  };

  const handleVerifyCode = async () => {
    setLoading(true);
    setMessage('');

    try {
      const auth = getAuth();
      const user = auth.currentUser;

      if (!user) {
        setMessage('❌ Error: No user logged in');
        setLoading(false);
        return;
      }

      // Query for the verification code in Firestore
      const q = query(
        collection(db, 'admin_verification_codes'),
        where('code', '==', formData.verificationCode),
        where('userId', '==', user.uid),
        where('used', '==', false)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setMessage('❌ Invalid or expired verification code');
        setLoading(false);
        return;
      }

      const codeDoc = querySnapshot.docs[0];
      const codeData = codeDoc.data();
      
      // Check if code is expired (older than 30 minutes)
      const thirtyMinutesAgo = Timestamp.fromDate(new Date(Date.now() - 30 * 60 * 1000));
      if (codeData.createdAt <= thirtyMinutesAgo) {
        // Delete expired code
        await deleteDoc(doc(db, 'admin_verification_codes', codeDoc.id));
        setMessage('❌ Verification code has expired');
        setLoading(false);
        return;
      }

      // Mark code as used
      await setDoc(doc(db, 'admin_verification_codes', codeDoc.id), {
        ...codeData,
        used: true,
        usedAt: Timestamp.now()
      });

      // Create admin document
      await setDoc(doc(db, 'admins', user.uid), {
        email: formData.email,
        name: formData.name,
        role: 'admin',
        createdAt: Timestamp.now(),
        permissions: ['manage_complaints', 'view_reports', 'user_management'],
        verifiedAt: Timestamp.now()
      });

      setMessage('✅ Admin access verified and created! Redirecting to dashboard...');
      setTimeout(() => navigate('/admin-dashboard'), 2000);

    } catch (error) {
      console.error('Error verifying code:', error);
      setMessage('❌ Error verifying code: ' + error.message);
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#F3F4F6',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '2rem',
        borderRadius: '8px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        width: '100%',
        maxWidth: '400px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{
            fontSize: '2rem',
            fontWeight: 'bold',
            color: '#1F2937',
            marginBottom: '0.5rem'
          }}>
            � Secure Admin Setup
          </h1>
          <p style={{ color: '#6B7280' }}>
            {step === 'verify' 
              ? 'Verify admin credentials to proceed' 
              : step === 'create'
              ? 'Creating admin account and verification code'
              : 'Enter verification code to complete setup'}
          </p>
        </div>

        {step === 'verify' ? (
          <form onSubmit={handleVerifyAdmin}>
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="email" style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '0.5rem'
              }}>
                Admin Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  boxSizing: 'border-box'
                }}
                placeholder="Enter admin email"
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="password" style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '0.5rem'
              }}>
                Admin Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                required
                minLength="6"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  boxSizing: 'border-box'
                }}
                placeholder="Enter admin password (min 6 characters)"
              />
              <div style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '0.25rem' }}>
                Password must be at least 6 characters long
              </div>
            </div>

            <div style={{
              backgroundColor: '#EEF2FF',
              border: '1px solid #C7D2FE',
              borderRadius: '6px',
              padding: '1rem',
              marginBottom: '1.5rem'
            }}>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#3730A3' }}>
                🔒 <strong>Secure Admin Access:</strong> Enter your admin credentials to create secure access to the management dashboard.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                backgroundColor: loading ? '#9CA3AF' : '#DC2626',
                color: 'white',
                padding: '0.75rem',
                border: 'none',
                borderRadius: '6px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s'
              }}
            >
              {loading ? 'Verifying...' : 'Setup Admin Access'}
            </button>
          </form>
        ) : step === 'create' ? (
          <div>
            <div style={{
              backgroundColor: '#EEF2FF',
              border: '1px solid #C7D2FE',
              borderRadius: '6px',
              padding: '1rem',
              marginBottom: '1.5rem',
              textAlign: 'center'
            }}>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#3730A3' }}>
                🔄 <strong>Creating Admin Account...</strong><br />
                This will generate a verification code stored securely in Firestore database. Admins must access the database directly to retrieve the code.
              </p>
            </div>

            <button
              onClick={handleCreateAccount}
              disabled={loading}
              style={{
                width: '100%',
                backgroundColor: loading ? '#9CA3AF' : '#059669',
                color: 'white',
                padding: '0.75rem',
                border: 'none',
                borderRadius: '6px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s'
              }}
            >
              {loading ? 'Creating Account...' : 'Create Admin Account & Generate Code'}
            </button>

            <button
              onClick={() => setStep('verify')}
              disabled={loading}
              style={{
                width: '100%',
                backgroundColor: 'transparent',
                color: '#6B7280',
                padding: '0.5rem',
                border: 'none',
                fontSize: '0.875rem',
                cursor: 'pointer',
                marginTop: '0.5rem'
              }}
            >
              ← Back to Verification
            </button>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="verificationCode" style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '0.5rem'
              }}>
                Verification Code
              </label>
              <input
                type="text"
                id="verificationCode"
                name="verificationCode"
                value={formData.verificationCode}
                onChange={handleInputChange}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  boxSizing: 'border-box',
                  textAlign: 'center',
                  letterSpacing: '2px'
                }}
                placeholder="Enter verification code"
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="name" style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '0.5rem'
              }}>
                Admin Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  boxSizing: 'border-box'
                }}
                placeholder="Enter admin name"
              />
            </div>

            {/* Remove the generated code display section */}

            <button
              onClick={handleVerifyCode}
              disabled={loading || !formData.verificationCode || !formData.name}
              style={{
                width: '100%',
                backgroundColor: loading ? '#9CA3AF' : '#059669',
                color: 'white',
                padding: '0.75rem',
                border: 'none',
                borderRadius: '6px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s'
              }}
            >
              {loading ? 'Verifying...' : 'Verify Code & Complete Setup'}
            </button>

            <button
              onClick={() => setStep('verify')}
              disabled={loading}
              style={{
                width: '100%',
                backgroundColor: 'transparent',
                color: '#6B7280',
                padding: '0.5rem',
                border: 'none',
                fontSize: '0.875rem',
                cursor: 'pointer',
                marginTop: '0.5rem'
              }}
            >
              ← Back to Verification
            </button>
          </div>
        )}

        {message && (
          <div style={{
            backgroundColor: message.includes('Error') ? '#FEE2E2' : '#D1FAE5',
            border: message.includes('Error') ? '1px solid #FECACA' : '1px solid #A7F3D0',
            color: message.includes('Error') ? '#DC2626' : '#065F46',
            padding: '0.75rem',
            borderRadius: '6px',
            marginTop: '1rem',
            fontSize: '0.875rem'
          }}>
            {message}
          </div>
        )}

        <div style={{
          marginTop: '2rem',
          textAlign: 'center',
          fontSize: '0.875rem',
          color: '#6B7280'
        }}>
          <button
            onClick={() => navigate('/explore')}
            style={{
              background: 'none',
              border: 'none',
              color: '#3B82F6',
              textDecoration: 'underline',
              cursor: 'pointer'
            }}
          >
            ← Back to Lokal
          </button>
        </div>

        <div style={{
          marginTop: '1rem',
          padding: '1rem',
          backgroundColor: '#FEE2E2',
          borderRadius: '6px',
          fontSize: '0.75rem',
          color: '#DC2626'
        }}>
          <strong>⚠️ SECURITY WARNING:</strong> This admin setup page should be removed or properly secured before production deployment. Ensure proper access controls are in place.
        </div>
      </div>
    </div>
  );
}

export default AdminSetupPage;
