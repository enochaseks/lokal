import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { getAuth, createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { app } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { setDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { addOrUpdateContact } from '../utils/hubspotClient';
// Removed debug imports

function RegisterPage() {
  // SEO optimization for register page
  useEffect(() => {
    document.title = "Lokal - Sign Up";
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 
        'Create your free account on Lokal Shops to discover and support African, Caribbean & Black businesses. Join our community today!'
      );
    }

    const canonicalLink = document.querySelector('link[rel="canonical"]');
    if (canonicalLink) {
      canonicalLink.setAttribute('href', 'https://lokalshops.co.uk/register');
    }

    // Update keywords for register page
    let metaKeywords = document.querySelector('meta[name="keywords"]');
    if (metaKeywords) {
      metaKeywords.setAttribute('content', 
        'sign up lokal shops, register account, african caribbean business directory, black business directory, join community'
      );
    }

    // Add structured data for registration
    const structuredData = {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": "Sign Up - Lokal Shops",
      "description": "Create your free account to discover and support African, Caribbean & Black businesses",
      "url": "https://lokalshops.co.uk/register",
      "mainEntity": {
        "@type": "RegisterAction",
        "target": "https://lokalshops.co.uk/register",
        "name": "Create Account"
      }
    };

    // Remove existing structured data
    const existingScript = document.querySelector('script[type="application/ld+json"]');
    if (existingScript) {
      existingScript.remove();
    }

    // Add new structured data
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(structuredData);
    document.head.appendChild(script);
  }, []);
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



  // No auth state listener needed on registration page
  // Users will manually verify their email and navigate away

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
      const auth = getAuth(app);
      const normalizedEmail = email.trim().toLowerCase();
      
      // Create the user account
      const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      const user = userCredential.user;

      // Create user document in Firestore
      const userDoc = {
        email: normalizedEmail,
        dateOfBirth: dob,
        createdAt: new Date().toISOString(),
        onboardingStep: 'onboarding',
        marketingConsent: marketingConsent,
        emailVerified: false,
        uid: user.uid,

      };

      await setDoc(doc(db, 'users', user.uid), userDoc);
      
      // Send email verification with Firebase default settings
      console.log('Registration: Sending verification email to:', user.email);
      console.log('Registration: Auth domain:', getAuth().app.options.authDomain);
      console.log('Registration: Project ID:', getAuth().app.options.projectId);
      console.log('Registration: Using Firebase default email settings to avoid domain authorization issues...');
      
      let emailSent = false;
      let lastError = null;
      
      try {
        await sendEmailVerification(user);
        console.log('Registration: Verification email sent successfully with default settings');
        emailSent = true;
      } catch (emailError) {
        console.error('Registration: Email verification failed:', emailError);
        lastError = emailError;
      }
      
      if (!emailSent) {
        console.error('Registration: Failed to send verification email after all attempts');
        if (lastError) {
          console.error('Registration: Last error details:', {
            code: lastError.code,
            message: lastError.message,
            stack: lastError.stack
          });
          
          // Provide specific error messages
          let errorMsg = 'Account created, but there was an issue sending the verification email. ';
          
          if (lastError.code === 'auth/unauthorized-domain') {
            errorMsg += 'This appears to be a domain configuration issue. ';
            console.error('CRITICAL: Unauthorized domain error. Add current domain to Firebase Console');
          } else if (lastError.code === 'auth/operation-not-allowed') {
            errorMsg += 'Email verification is not enabled. ';
            console.error('CRITICAL: Email verification not enabled in Firebase Console');
          } else if (lastError.code === 'auth/quota-exceeded') {
            errorMsg += 'Email quota exceeded. ';
          } else if (lastError.code === 'auth/invalid-continue-uri') {
            errorMsg += 'Configuration error with verification URL. ';
            console.error('CRITICAL: Invalid continue URL configuration');
          }
          
          errorMsg += 'You can request a new verification email from the verification page.';
          setError(errorMsg);
        } else {
          setError('Account created, but there was an issue sending the verification email. You can request a new verification email from the verification page.');
        }
      }
      
      // Add to HubSpot in background (non-blocking)
      if (marketingConsent) {
        addOrUpdateContact({
          email: normalizedEmail,
          marketingConsent: true
        }).catch(hubspotError => {
          console.warn('HubSpot integration failed:', hubspotError);
        });
      }
      
      setVerificationSent(true);
      setSuccess('Account created successfully! Please check your email (including spam folder) and click the verification link to complete your registration.');
      
      // Redirect to verification page after a short delay
      setTimeout(() => {
        navigate('/verify-email');
      }, 1500);
      
    } catch (err) {
      console.error('Registration error:', err);
      
      // Handle specific Firebase Auth errors
      if (err.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists. Please use a different email or try logging in.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak. Please choose a stronger password.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Registration is currently disabled. Please contact support.');
        console.error('FIREBASE SETUP REQUIRED: Email/Password authentication must be enabled in Firebase Console');
        console.error('Go to: Firebase Console > Authentication > Sign-in method > Email/Password > Enable');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Network error. Please check your internet connection and try again.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many registration attempts. Please wait a few minutes and try again.');
      } else {
        setError('Registration failed: ' + (err.message || 'Please try again.'));
      }
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
                style={{ 
                  marginRight: '8px', 
                  marginTop: '4px',
                  minWidth: '20px', 
                  minHeight: '20px',
                  width: '20px',
                  height: '20px',
                  accentColor: '#D92D20',
                  boxSizing: 'border-box',
                  border: '2px solid #1C1C1C'
                }}
                required
              />
              <label htmlFor="termsCheckbox" style={{ fontSize: '0.9rem', lineHeight: '1.4', color: '#1C1C1C' }}>
                I have read and agree to the <a 
                  href="/settings" 
                  onClick={(e) => {
                    e.preventDefault();
                    window.localStorage.setItem('redirectToTerms', 'true');
                    navigate('/settings', { state: { fromRegister: true } });
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
                style={{ 
                  marginRight: '8px', 
                  marginTop: '4px',
                  minWidth: '20px', 
                  minHeight: '20px',
                  width: '20px',
                  height: '20px',
                  accentColor: '#D92D20',
                  boxSizing: 'border-box',
                  border: '2px solid #1C1C1C'
                }}
                required
              />
              <label htmlFor="privacyCheckbox" style={{ fontSize: '0.9rem', lineHeight: '1.4', color: '#1C1C1C' }}>
                I have read and agree to the <a 
                  href="/settings" 
                  onClick={(e) => {
                    e.preventDefault();
                    window.localStorage.setItem('redirectToPrivacy', 'true');
                    navigate('/settings', { state: { fromRegister: true } });
                  }}
                  style={{ color: '#007B7F', textDecoration: 'underline' }}
                >Privacy Policy</a>
              </label>
            </div>
            
            {/* Marketing Consent Checkbox */}
            <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '1rem', background: '#f8f9fa', padding: '12px', borderRadius: '4px' }}>
              <input 
                type="checkbox" 
                id="marketingCheckbox"
                checked={marketingConsent}
                onChange={() => setMarketingConsent(!marketingConsent)}
                style={{ 
                  marginRight: '8px', 
                  marginTop: '4px',
                  minWidth: '20px', 
                  minHeight: '20px',
                  width: '20px',
                  height: '20px',
                  accentColor: '#D92D20',
                  boxSizing: 'border-box',
                  border: '2px solid #1C1C1C',
                  cursor: 'pointer'
                }}
              />
              <label htmlFor="marketingCheckbox" style={{ fontSize: '0.9rem', lineHeight: '1.4', color: '#1C1C1C' }}>
                I consent to receive marketing communications about special offers, new features, and personalized recommendations. You can unsubscribe at any time.
              </label>
            </div>
          </div>

          {/* Marketing Status Message */}
          {marketingConsent && (
            <div style={{ 
              marginBottom: '1rem',
              background: '#e6f7e6', 
              border: '1px solid #28a745', 
              borderRadius: '4px', 
              padding: '10px', 
              fontSize: '0.9rem',
              color: '#155724'
            }}>
              <p style={{ margin: 0 }}>✓ You'll receive our marketing communications with special offers and new features.</p>
            </div>
          )}

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
            {verificationSent ? 'Registration Complete - Check Email' : 'Register'}
          </button>
        </form>
        {verificationSent && (
          <div style={{ 
            backgroundColor: '#f0f7f7', 
            border: '1px solid #007B7F', 
            borderRadius: '8px', 
            padding: '15px', 
            marginTop: '1rem', 
            textAlign: 'center' 
          }}>
            <h4 style={{ color: '#007B7F', margin: '0 0 10px 0' }}>✉️ Verification Email Sent!</h4>
            <p style={{ margin: '0 0 10px 0', color: '#333' }}>
              Please check your email and click the verification link to complete your registration.
            </p>
            <div style={{ 
              backgroundColor: '#FFF7E6', 
              border: '1px solid #FFD700', 
              borderRadius: '4px', 
              padding: '10px', 
              marginBottom: '15px' 
            }}>
              <p style={{ margin: 0, color: '#E65100', fontSize: '0.9rem', fontWeight: 'bold' }}>
                ⚠️ Important: Check your spam/junk folder!
              </p>
              <p style={{ margin: '5px 0 0 0', color: '#666', fontSize: '0.8rem' }}>
                Verification emails sometimes end up in spam folders.
              </p>
            </div>
            <button
              onClick={async () => {
                const auth = getAuth(app);
                if (auth.currentUser) {
                  await auth.currentUser.reload();
                  if (auth.currentUser.emailVerified) {
                    // Check onboarding step and navigate accordingly
                    const { doc, getDoc } = await import('firebase/firestore');
                    const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
                    if (userDoc.exists()) {
                      const onboardingStep = userDoc.data().onboardingStep;
                      if (onboardingStep && onboardingStep !== 'complete') {
                        navigate('/' + onboardingStep);
                        return;
                      }
                    }
                    navigate('/onboarding');
                  } else {
                    alert('Email not verified yet. Please check your email and click the verification link.');
                  }
                }
              }}
              style={{
                backgroundColor: '#007B7F',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '8px 16px',
                fontSize: '0.9rem',
                cursor: 'pointer'
              }}
            >
              I've verified my email - Continue
            </button>
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