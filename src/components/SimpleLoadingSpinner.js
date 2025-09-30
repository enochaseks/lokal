import React from 'react';

const SimpleLoadingSpinner = ({ 
  message = "Loading...", 
  size = "medium", 
  overlay = false,
  backgroundColor = "rgba(240, 242, 245, 0.95)"
}) => {
  
  const getSizeStyles = () => {
    switch (size) {
      case "small":
        return { logo: 60, rings: [80, 100, 120], text: 16 };
      case "large":
        return { logo: 150, rings: [180, 220, 260], text: 32 };
      default: // medium
        return { logo: 100, rings: [130, 160, 190], text: 24 };
    }
  };

  const sizeStyles = getSizeStyles();
  
  const containerStyle = overlay ? {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: backgroundColor,
    zIndex: 9998,
    ...styles.container
  } : {
    ...styles.container,
    position: 'relative',
    minHeight: '200px',
    backgroundColor: 'transparent'
  };

  return (
    <div style={containerStyle}>
      {/* Logo with animated rings */}
      <div style={styles.logoContainer}>
        <div style={styles.logoWrapper}>
          <img 
            src="/images/logo png.png" 
            alt="Lokal" 
            style={{
              ...styles.logo,
              width: `${sizeStyles.logo}px`,
              height: 'auto'
            }}
          />
          {/* Animated rings */}
          {sizeStyles.rings.map((ringSize, index) => (
            <div
              key={index}
              style={{
                ...styles.ring,
                width: `${ringSize}px`,
                height: `${ringSize}px`,
                animationDelay: `${index * 0.3}s`,
                border: `${2 + index}px solid rgba(${
                  index === 0 ? '0, 123, 127' : 
                  index === 1 ? '16, 185, 129' : 
                  '5, 150, 105'
                }, ${0.4 - index * 0.1})`
              }}
            />
          ))}
        </div>
      </div>
      
      {/* Loading message */}
      <div style={{
        ...styles.message,
        fontSize: `${sizeStyles.text}px`
      }}>
        {message}
        <div style={styles.dots}>
          <span style={styles.dot}>.</span>
          <span style={{...styles.dot, animationDelay: '0.2s'}}>.</span>
          <span style={{...styles.dot, animationDelay: '0.4s'}}>.</span>
        </div>
      </div>
      
      {/* Inline styles for animations */}
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes bounce {
          0%, 60%, 100% { 
            opacity: 0.3;
            transform: translateY(0);
          }
          30% { 
            opacity: 1;
            transform: translateY(-8px);
          }
        }
        
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  
  logoContainer: {
    position: 'relative',
    marginBottom: '20px'
  },
  
  logoWrapper: {
    position: 'relative',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center'
  },
  
  logo: {
    zIndex: 2,
    filter: 'drop-shadow(0 2px 10px rgba(0, 0, 0, 0.1))',
    animation: 'pulse 2s ease-in-out infinite'
  },
  
  ring: {
    position: 'absolute',
    borderRadius: '50%',
    animation: 'spin 2s linear infinite'
  },
  
  message: {
    fontWeight: '600',
    color: '#4A4A4A',
    textAlign: 'center',
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  
  dots: {
    display: 'flex',
    gap: '2px'
  },
  
  dot: {
    animation: 'bounce 1s ease-in-out infinite',
    color: '#007B7F',
    fontWeight: 'bold'
  }
};

export default SimpleLoadingSpinner;