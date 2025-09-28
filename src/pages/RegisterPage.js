import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { getAuth, createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { app } from '../firebase';
import { useNavigate } from 'react-router';
import { getDocs, collection, query, where, setDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { addOrUpdateContact } from '../utils/hubspotClient';

function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [dob, setDob] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordValidation, setPasswordValidation] = useState({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecialChar: false
  });
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const navigate = useNavigate();

  // Password validation function
  const validatePassword = (password) => {
    const validation = {
      minLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /\d/.test(password),
      hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    };
    setPasswordValidation(validation);
    return Object.values(validation).every(Boolean);
  };

  // Check if password meets all requirements
  const isPasswordValid = Object.values(passwordValidation).every(Boolean);

  // Handle password change with validation
  const handlePasswordChange = (e) => {
    const newPassword = e.target.value;
    setPassword(newPassword);
    validatePassword(newPassword);
  };

  useEffect(() => {
    const auth = getAuth(app);
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user && user.emailVerified) {
        // Check onboardingStep
        const { doc, getDoc } = await import('firebase/firestore');
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const onboardingStep = userDoc.data().onboardingStep;
          if (onboardingStep && onboardingStep !== 'complete') {
            navigate('/' + onboardingStep);
            return;
          }
        }
        navigate('/onboarding');
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setVerificationSent(false);
    
    // Check password requirements
    if (!isPasswordValid) {
      setError('Password does not meet all requirements. Please check the requirements below.');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    // Check if user has agreed to terms and privacy policy
    if (!agreedToTerms || !agreedToPrivacy) {
      setError('You must agree to both the Terms of Service and Privacy Policy to continue.');
      return;
    }
    
    // Age validation
    const today = new Date();
    const dobDate = new Date(dob);
    const age = today.getFullYear() - dobDate.getFullYear();
    const m = today.getMonth() - dobDate.getMonth();
    const isBirthdayPassed = m > 0 || (m === 0 && today.getDate() >= dobDate.getDate());
    const actualAge = isBirthdayPassed ? age : age - 1;
    if (actualAge < 16) {
      setError('You must be at least 16 years old to sign up.');
      return;
    }
    try {
      // Check if email is deactivated in users or stores
      const usersQuery = query(collection(db, 'users'), where('email', '==', email), where('deactivated', '==', true));
      const usersSnap = await getDocs(usersQuery);
      const storesQuery = query(collection(db, 'stores'), where('email', '==', email), where('deactivated', '==', true));
      const storesSnap = await getDocs(storesQuery);
      if (!usersSnap.empty || !storesSnap.empty) {
        setError('This email is associated with a deactivated account. Please contact support.');
        return;
      }
      const auth = getAuth(app);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const { setDoc, doc, getDoc } = await import('firebase/firestore');
      const userRef = doc(db, 'users', userCredential.user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          email,
          createdAt: new Date().toISOString(),
          onboardingStep: 'onboarding',
          marketingConsent: marketingConsent,
        });
        
        // Add the user to HubSpot if they consented to marketing
        if (marketingConsent) {
          try {
            await addOrUpdateContact({
              email,
              marketingConsent: true
            });
            console.log('User added to HubSpot marketing');
          } catch (hubspotError) {
            console.error('Failed to add user to HubSpot:', hubspotError);
            // Don't block registration if HubSpot integration fails
          }
        }
      }
      await sendEmailVerification(userCredential.user);
      setVerificationSent(true);
      setSuccess('Account created! Please check your email to verify your account.');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ background: '#F9F5EE', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: 400, margin: '2rem auto', background: '#fff', padding: '2rem', borderRadius: '8px', boxShadow: '0 2px 8px #B8B8B8' }}>
        <h2 style={{ color: '#D92D20', marginBottom: '1rem' }}>Register</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>Password</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input 
                type={showPassword ? 'text' : 'password'} 
                value={password} 
                onChange={handlePasswordChange} 
                style={{ 
                  width: '100%', 
                  padding: '0.5rem', 
                  paddingRight: '2.5rem',
                  border: `1px solid ${password && !isPasswordValid ? '#D92D20' : '#B8B8B8'}`, 
                  borderRadius: 4,
                  fontSize: '1rem',
                  boxSizing: 'border-box',
                  outline: 'none'
                }} 
                required 
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  color: '#666',
                  padding: '0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '20px',
                  height: '20px',
                  lineHeight: '1',
                  zIndex: 1
                }}
                onMouseOver={(e) => e.target.style.color = '#333'}
                onMouseOut={(e) => e.target.style.color = '#666'}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
            
            {/* Password Requirements */}
            {password && (
              <div style={{ 
                marginTop: '0.5rem',
                padding: '0.75rem',
                background: '#f8f9fa',
                border: '1px solid #e9ecef',
                borderRadius: 4,
                fontSize: '0.85rem'
              }}>
                <div style={{ fontWeight: '600', marginBottom: '0.5rem', color: '#495057' }}>
                  Password Requirements:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    color: passwordValidation.minLength ? '#28a745' : '#dc3545' 
                  }}>
                    <span style={{ marginRight: '0.5rem', fontSize: '0.8rem' }}>
                      {passwordValidation.minLength ? '✅' : '❌'}
                    </span>
                    At least 8 characters long
                  </div>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    color: passwordValidation.hasUppercase ? '#28a745' : '#dc3545' 
                  }}>
                    <span style={{ marginRight: '0.5rem', fontSize: '0.8rem' }}>
                      {passwordValidation.hasUppercase ? '✅' : '❌'}
                    </span>
                    At least one uppercase letter (A-Z)
                  </div>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    color: passwordValidation.hasLowercase ? '#28a745' : '#dc3545' 
                  }}>
                    <span style={{ marginRight: '0.5rem', fontSize: '0.8rem' }}>
                      {passwordValidation.hasLowercase ? '✅' : '❌'}
                    </span>
                    At least one lowercase letter (a-z)
                  </div>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    color: passwordValidation.hasNumber ? '#28a745' : '#dc3545' 
                  }}>
                    <span style={{ marginRight: '0.5rem', fontSize: '0.8rem' }}>
                      {passwordValidation.hasNumber ? '✅' : '❌'}
                    </span>
                    At least one number (0-9)
                  </div>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    color: passwordValidation.hasSpecialChar ? '#28a745' : '#dc3545' 
                  }}>
                    <span style={{ marginRight: '0.5rem', fontSize: '0.8rem' }}>
                      {passwordValidation.hasSpecialChar ? '✅' : '❌'}
                    </span>
                    At least one special character (!@#$%^&*)
                  </div>
                </div>
                
                {/* Password Strength Indicator */}
                <div style={{ marginTop: '0.75rem' }}>
                  <div style={{ fontWeight: '600', marginBottom: '0.25rem', color: '#495057' }}>
                    Password Strength:
                  </div>
                  <div style={{ 
                    width: '100%', 
                    height: '8px', 
                    backgroundColor: '#e9ecef', 
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${(Object.values(passwordValidation).filter(Boolean).length / 5) * 100}%`,
                      height: '100%',
                      backgroundColor: 
                        Object.values(passwordValidation).filter(Boolean).length < 3 ? '#dc3545' :
                        Object.values(passwordValidation).filter(Boolean).length < 5 ? '#ffc107' : '#28a745',
                      transition: 'all 0.3s ease'
                    }} />
                  </div>
                  <div style={{ 
                    fontSize: '0.8rem', 
                    marginTop: '0.25rem',
                    color: 
                      Object.values(passwordValidation).filter(Boolean).length < 3 ? '#dc3545' :
                      Object.values(passwordValidation).filter(Boolean).length < 5 ? '#856404' : '#155724',
                    fontWeight: '500'
                  }}>
                    {Object.values(passwordValidation).filter(Boolean).length < 3 ? 'Weak' :
                     Object.values(passwordValidation).filter(Boolean).length < 5 ? 'Medium' : 'Strong'}
                  </div>
                </div>
              </div>
            )}
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>Confirm Password</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input 
                type={showConfirmPassword ? 'text' : 'password'} 
                value={confirmPassword} 
                onChange={e => setConfirmPassword(e.target.value)} 
                style={{ 
                  width: '100%', 
                  padding: '0.5rem', 
                  paddingRight: '2.5rem',
                  border: `1px solid ${
                    confirmPassword && password !== confirmPassword ? '#D92D20' : 
                    confirmPassword && password === confirmPassword ? '#28a745' : '#B8B8B8'
                  }`, 
                  borderRadius: 4,
                  fontSize: '1rem',
                  boxSizing: 'border-box',
                  outline: 'none'
                }} 
                required 
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  color: '#666',
                  padding: '0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '20px',
                  height: '20px',
                  lineHeight: '1',
                  zIndex: 1
                }}
                onMouseOver={(e) => e.target.style.color = '#333'}
                onMouseOut={(e) => e.target.style.color = '#666'}
                title={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? '🙈' : '👁️'}
              </button>
            </div>
            
            {/* Password Match Indicator */}
            {confirmPassword && (
              <div style={{ 
                marginTop: '0.5rem',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                color: password === confirmPassword ? '#28a745' : '#dc3545'
              }}>
                <span style={{ marginRight: '0.5rem', fontSize: '0.8rem' }}>
                  {password === confirmPassword ? '✅' : '❌'}
                </span>
                {password === confirmPassword ? 'Passwords match' : 'Passwords do not match'}
              </div>
            )}
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ color: '#1C1C1C', display: 'block', marginBottom: 4 }}>Date of Birth</label>
            <input type="date" value={dob} onChange={e => setDob(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #B8B8B8', borderRadius: 4 }} required />
          </div>
          
          {/* Terms of Service and Privacy Policy Checkboxes */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
              <input 
                type="checkbox" 
                id="termsCheckbox"
                checked={agreedToTerms}
                onChange={() => setAgreedToTerms(!agreedToTerms)}
                style={{ marginRight: '8px', marginTop: '4px' }}
                required
              />
              <label htmlFor="termsCheckbox" style={{ fontSize: '0.9rem', lineHeight: '1.4', color: '#1C1C1C' }}>
                I have read and agree to the <a 
                  href="/settings" 
                  onClick={(e) => {
                    e.preventDefault();
                    window.localStorage.setItem('redirectToTerms', 'true');
                    navigate('/settings');
                  }}
                  style={{ color: '#007B7F', textDecoration: 'underline' }}
                >Terms of Service</a>
              </label>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
              <input 
                type="checkbox" 
                id="privacyCheckbox"
                checked={agreedToPrivacy}
                onChange={() => setAgreedToPrivacy(!agreedToPrivacy)}
                style={{ marginRight: '8px', marginTop: '4px' }}
                required
              />
              <label htmlFor="privacyCheckbox" style={{ fontSize: '0.9rem', lineHeight: '1.4', color: '#1C1C1C' }}>
                I have read and agree to the <a 
                  href="/settings" 
                  onClick={(e) => {
                    e.preventDefault();
                    window.localStorage.setItem('redirectToPrivacy', 'true');
                    navigate('/settings');
                  }}
                  style={{ color: '#007B7F', textDecoration: 'underline' }}
                >Privacy Policy</a>
              </label>
            </div>
            
            {/* Marketing Consent Checkbox */}
            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
              <input 
                type="checkbox" 
                id="marketingCheckbox"
                checked={marketingConsent}
                onChange={() => setMarketingConsent(!marketingConsent)}
                style={{ marginRight: '8px', marginTop: '4px' }}
              />
              <label htmlFor="marketingCheckbox" style={{ fontSize: '0.9rem', lineHeight: '1.4', color: '#1C1C1C' }}>
                I consent to receive marketing communications about special offers, new features, and personalized recommendations. You can unsubscribe at any time.
              </label>
            </div>
          </div>

          {error && <div style={{ color: '#D92D20', marginBottom: '1rem' }}>{error}</div>}
          {success && <div style={{ color: '#3A8E3A', marginBottom: '1rem' }}>{success}</div>}
          <button 
            type="submit" 
            style={{ 
              width: '100%', 
              background: (!isPasswordValid || password !== confirmPassword || !agreedToTerms || !agreedToPrivacy || verificationSent) ? '#ccc' : '#D92D20', 
              color: '#fff', 
              padding: '0.75rem', 
              border: 'none', 
              borderRadius: 4, 
              fontWeight: 'bold', 
              fontSize: '1rem',
              cursor: (!isPasswordValid || password !== confirmPassword || !agreedToTerms || !agreedToPrivacy || verificationSent) ? 'not-allowed' : 'pointer'
            }} 
            disabled={!isPasswordValid || password !== confirmPassword || !agreedToTerms || !agreedToPrivacy || verificationSent}
          >
            Register
          </button>
        </form>
        {verificationSent && (
          <div style={{ color: '#007B7F', marginTop: '1rem', textAlign: 'center' }}>
            Please verify your email to continue. Refresh this page after verification.
          </div>
        )}
        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <span style={{ color: '#1C1C1C' }}>Already have an account? </span>
          <a href="/login" style={{ color: '#007B7F', fontWeight: 'bold', textDecoration: 'none' }}>Login</a>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage; 