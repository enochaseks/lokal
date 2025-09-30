import React, { useState, useEffect } from 'react';

const LoadingSplash = ({ message = "Loading..." }) => {
  const [currentStep, setCurrentStep] = useState(0);
  
  const steps = [
    { text: "Welcome to Lokal", icon: "logo" },
    { text: "Connecting Store Owners", icon: "storeOwner" },
    { text: "Serving Happy Buyers", icon: "buyer" }
  ];

  // Cycle through steps every 2.5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep(prev => (prev + 1) % steps.length);
    }, 2500);

    return () => clearInterval(interval);
  }, []);
  return (
    <div style={styles.container}>
      {/* Animated background gradient */}
      <div style={styles.backgroundOverlay}></div>
      
      {/* Animated icon container */}
      <div style={styles.logoContainer}>
        <div style={styles.logoWrapper}>
          <div style={styles.iconContainer}>
            {/* Lokal Logo */}
            <div style={{
              ...styles.iconWrapper,
              opacity: currentStep === 0 ? 1 : 0,
              transform: currentStep === 0 ? 'scale(1) rotateY(0deg)' : 'scale(0.8) rotateY(90deg)'
            }}>
              <img 
                src="/images/logo png.png" 
                alt="Lokal" 
                style={styles.logo}
              />
            </div>
            
            {/* Store Owner Icon */}
            <div style={{
              ...styles.iconWrapper,
              opacity: currentStep === 1 ? 1 : 0,
              transform: currentStep === 1 ? 'scale(1) rotateY(0deg)' : 'scale(0.8) rotateY(-90deg)'
            }}>
              <svg width="120" height="120" viewBox="0 0 24 24" style={styles.svgIcon}>
                {/* Store owner with apron */}
                <circle cx="12" cy="8" r="3" fill="#007B7F"/>
                <path d="M12 14c-4 0-8 2-8 6v1h16v-1c0-4-4-6-8-6z" fill="#007B7F"/>
                {/* Apron */}
                <rect x="9" y="11" width="6" height="7" rx="1" fill="#10B981" opacity="0.8"/>
                {/* Store/shop icon */}
                <rect x="14" y="6" width="6" height="4" rx="1" fill="#059669"/>
                <path d="M16 10v2h2v-2" fill="#FFFFFF"/>
              </svg>
            </div>
            
            {/* Buyer Icon */}
            <div style={{
              ...styles.iconWrapper,
              opacity: currentStep === 2 ? 1 : 0,
              transform: currentStep === 2 ? 'scale(1) rotateY(0deg)' : 'scale(0.8) rotateY(-90deg)'
            }}>
              <svg width="120" height="120" viewBox="0 0 24 24" style={styles.svgIcon}>
                {/* Buyer person */}
                <circle cx="12" cy="8" r="3" fill="#007B7F"/>
                <path d="M12 14c-4 0-8 2-8 6v1h16v-1c0-4-4-6-8-6z" fill="#007B7F"/>
                {/* Shopping bag */}
                <path d="M16 10h2l-1 8h-6l-1-8h2" fill="#10B981" stroke="#059669" strokeWidth="1"/>
                {/* Happy face */}
                <circle cx="10" cy="7" r="0.5" fill="white"/>
                <circle cx="14" cy="7" r="0.5" fill="white"/>
                <path d="M10 9c1 1 3 1 4 0" stroke="white" strokeWidth="1" fill="none"/>
              </svg>
            </div>
          </div>
          
          {/* Animated rings around icons */}
          <div style={styles.ring1}></div>
          <div style={styles.ring2}></div>
          <div style={styles.ring3}></div>
        </div>
      </div>
      
      {/* Loading text with typewriter effect */}
      <div style={styles.textContainer}>
        <h2 style={styles.loadingText}>{steps[currentStep].text}</h2>
        <p style={styles.subText}>Setting up your marketplace experience...</p>
        <div style={styles.dotsContainer}>
          <span style={{...styles.dot, animationDelay: '0s'}}>.</span>
          <span style={{...styles.dot, animationDelay: '0.2s'}}>.</span>
          <span style={{...styles.dot, animationDelay: '0.4s'}}>.</span>
        </div>
      </div>
      
      {/* Progress indicators */}
      <div style={styles.progressIndicators}>
        {steps.map((_, index) => (
          <div
            key={index}
            style={{
              ...styles.progressDot,
              backgroundColor: index === currentStep ? '#007B7F' : 'rgba(0, 123, 127, 0.3)',
              transform: index === currentStep ? 'scale(1.2)' : 'scale(1)'
            }}
          />
        ))}
      </div>
      
      {/* Progress bar */}
      <div style={styles.progressBarContainer}>
        <div style={styles.progressBar}></div>
      </div>
      
      {/* Floating particles */}
      <div style={styles.particle1}></div>
      <div style={styles.particle2}></div>
      <div style={styles.particle3}></div>
      <div style={styles.particle4}></div>
      <div style={styles.particle5}></div>
      <div style={styles.particle6}></div>
    </div>
  );
};

const styles = {
  container: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    background: 'linear-gradient(135deg, #F0F2F5 0%, #FFFFFF 25%, #F9FAFB 50%, #F3F4F6 75%, #FFFFFF 100%)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    overflow: 'hidden',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
  },
  
  backgroundOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: `
      radial-gradient(circle at 20% 50%, rgba(0, 123, 127, 0.05) 0%, transparent 50%),
      radial-gradient(circle at 80% 20%, rgba(0, 123, 127, 0.03) 0%, transparent 50%),
      radial-gradient(circle at 40% 80%, rgba(16, 185, 129, 0.04) 0%, transparent 50%)
    `,
    animation: 'backgroundPulse 4s ease-in-out infinite alternate'
  },
  
  logoContainer: {
    position: 'relative',
    marginBottom: '40px'
  },
  
  logoWrapper: {
    position: 'relative',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    animation: 'logoFloat 3s ease-in-out infinite'
  },
  
  logo: {
    width: '120px',
    height: 'auto',
    maxWidth: '120px',
    zIndex: 2,
    filter: 'drop-shadow(0 4px 20px rgba(0, 0, 0, 0.15))',
    animation: 'logoPulse 2s ease-in-out infinite'
  },

  // Icon container styles
  iconContainer: {
    position: 'relative',
    width: '120px',
    height: '120px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3
  },

  iconWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
    filter: 'drop-shadow(0 4px 20px rgba(0, 0, 0, 0.15))'
  },

  svgIcon: {
    filter: 'drop-shadow(0 2px 10px rgba(0, 0, 0, 0.2))'
  },
  
  ring1: {
    position: 'absolute',
    width: '150px',
    height: '150px',
    border: '3px solid rgba(0, 123, 127, 0.2)',
    borderTop: '3px solid rgba(0, 123, 127, 0.6)',
    borderRadius: '50%',
    animation: 'ringRotate 3s linear infinite'
  },
  
  ring2: {
    position: 'absolute',
    width: '180px',
    height: '180px',
    border: '2px solid rgba(16, 185, 129, 0.15)',
    borderTop: '2px solid rgba(16, 185, 129, 0.5)',
    borderRadius: '50%',
    animation: 'ringRotate 4s linear infinite reverse'
  },
  
  ring3: {
    position: 'absolute',
    width: '210px',
    height: '210px',
    border: '1px solid rgba(0, 123, 127, 0.1)',
    borderRight: '1px solid rgba(0, 123, 127, 0.4)',
    borderRadius: '50%',
    animation: 'ringRotate 5s linear infinite'
  },
  
  textContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: '30px'
  },
  
  loadingText: {
    fontSize: '28px',
    fontWeight: '600',
    color: '#007B7F',
    margin: '0 0 8px 0',
    textAlign: 'center',
    transition: 'all 0.5s ease-in-out'
  },

  subText: {
    fontSize: '16px',
    fontWeight: '400',
    color: 'rgba(75, 85, 99, 0.8)',
    margin: '0 0 10px 0',
    textAlign: 'center',
    opacity: 0.9
  },

  progressIndicators: {
    display: 'flex',
    gap: '12px',
    marginBottom: '20px',
    alignItems: 'center'
  },

  progressDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: '0 2px 8px rgba(0, 123, 127, 0.15)'
  },
  
  dotsContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  
  dot: {
    fontSize: '24px',
    color: '#007B7F',
    animation: 'dotBounce 1s ease-in-out infinite'
  },
  
  progressBarContainer: {
    width: '200px',
    height: '4px',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: '2px',
    overflow: 'hidden',
    marginTop: '20px'
  },
  
  progressBar: {
    height: '100%',
    background: 'linear-gradient(90deg, #007B7F, #10B981, #059669, #007B7F)',
    backgroundSize: '200% 100%',
    borderRadius: '2px',
    animation: 'progressSlide 2s ease-in-out infinite'
  },
  
  // Floating particles - Lokal platform theme
  particle1: {
    position: 'absolute',
    width: '6px',
    height: '6px',
    backgroundColor: '#007B7F',
    borderRadius: '50%',
    top: '20%',
    left: '10%',
    animation: 'particleFloat1 4s ease-in-out infinite',
    boxShadow: '0 0 8px rgba(0, 123, 127, 0.6)'
  },
  
  particle2: {
    position: 'absolute',
    width: '4px',
    height: '4px',
    backgroundColor: '#10B981',
    borderRadius: '50%',
    top: '30%',
    right: '15%',
    animation: 'particleFloat2 5s ease-in-out infinite',
    boxShadow: '0 0 6px rgba(16, 185, 129, 0.6)'
  },
  
  particle3: {
    position: 'absolute',
    width: '8px',
    height: '8px',
    backgroundColor: '#059669',
    borderRadius: '50%',
    bottom: '25%',
    left: '20%',
    animation: 'particleFloat3 3.5s ease-in-out infinite',
    boxShadow: '0 0 10px rgba(5, 150, 105, 0.6)'
  },
  
  particle4: {
    position: 'absolute',
    width: '5px',
    height: '5px',
    backgroundColor: 'rgba(0, 123, 127, 0.8)',
    borderRadius: '50%',
    top: '60%',
    right: '25%',
    animation: 'particleFloat1 6s ease-in-out infinite reverse',
    boxShadow: '0 0 7px rgba(0, 123, 127, 0.4)'
  },
  
  particle5: {
    position: 'absolute',
    width: '7px',
    height: '7px',
    backgroundColor: 'rgba(16, 185, 129, 0.7)',
    borderRadius: '50%',
    bottom: '40%',
    right: '10%',
    animation: 'particleFloat2 4.5s ease-in-out infinite',
    boxShadow: '0 0 9px rgba(16, 185, 129, 0.4)'
  },
  
  particle6: {
    position: 'absolute',
    width: '3px',
    height: '3px',
    backgroundColor: '#FFFFFF',
    borderRadius: '50%',
    top: '70%',
    left: '15%',
    animation: 'particleFloat3 5.5s ease-in-out infinite reverse',
    boxShadow: '0 0 5px rgba(255, 255, 255, 0.8)'
  }
};

// Add CSS animations as a style tag
const AnimationStyles = () => (
  <style>
    {`
      @keyframes logoFloat {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-10px); }
      }
      
      @keyframes logoPulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
      }
      
      @keyframes ringRotate {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      
      @keyframes textGradient {
        0%, 100% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
      }
      
      @keyframes dotBounce {
        0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
        30% { transform: translateY(-10px); opacity: 1; }
      }
      
      @keyframes progressSlide {
        0% { transform: translateX(-100%); }
        50% { transform: translateX(0%); }
        100% { transform: translateX(100%); }
      }
      
      @keyframes backgroundPulse {
        0% { opacity: 0.3; }
        100% { opacity: 0.6; }
      }
      
      @keyframes particleFloat1 {
        0%, 100% { transform: translate(0, 0) rotate(0deg); opacity: 0.7; }
        25% { transform: translate(10px, -15px) rotate(90deg); opacity: 1; }
        50% { transform: translate(-5px, -25px) rotate(180deg); opacity: 0.5; }
        75% { transform: translate(-15px, -10px) rotate(270deg); opacity: 0.8; }
      }
      
      @keyframes particleFloat2 {
        0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.6; }
        33% { transform: translate(-20px, 10px) scale(1.2); opacity: 1; }
        66% { transform: translate(15px, -20px) scale(0.8); opacity: 0.4; }
      }
      
      @keyframes particleFloat3 {
        0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); opacity: 0.5; }
        50% { transform: translate(25px, 15px) rotate(180deg) scale(1.3); opacity: 1; }
      }
      

      
      /* Responsive adjustments */
      @media (max-width: 768px) {
        .loading-text {
          font-size: 24px !important;
        }
        .logo {
          width: 100px !important;
        }
        .ring1 { width: 130px !important; height: 130px !important; }
        .ring2 { width: 160px !important; height: 160px !important; }
        .ring3 { width: 190px !important; height: 190px !important; }
      }
      
      @media (max-width: 480px) {
        .loading-text {
          font-size: 20px !important;
        }
        .logo {
          width: 80px !important;
        }
        .ring1 { width: 110px !important; height: 110px !important; }
        .ring2 { width: 140px !important; height: 140px !important; }
        .ring3 { width: 170px !important; height: 170px !important; }
      }
    `}
  </style>
);

const LoadingSplashWithStyles = (props) => (
  <>
    <AnimationStyles />
    <LoadingSplash {...props} />
  </>
);

export default LoadingSplashWithStyles;