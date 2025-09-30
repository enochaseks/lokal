import React, { useState, useEffect } from 'react';
import LoadingSplash from './LoadingSplash';

const LoadingSplashManager = ({ 
  isLoading = true, 
  minDisplayTime = 2000, 
  fadeOutDuration = 800,
  message = "Loading...",
  onComplete = () => {},
  children 
}) => {
  const [showSplash, setShowSplash] = useState(isLoading);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  useEffect(() => {
    if (!isLoading && showSplash) {
      // Start fade out animation
      setIsAnimatingOut(true);
      
      // Hide splash after fade out completes
      const fadeOutTimer = setTimeout(() => {
        setShowSplash(false);
        onComplete();
      }, fadeOutDuration);

      return () => clearTimeout(fadeOutTimer);
    }
  }, [isLoading, showSplash, fadeOutDuration, onComplete]);

  useEffect(() => {
    if (isLoading) {
      setShowSplash(true);
      setIsAnimatingOut(false);
    }
  }, [isLoading]);

  const splashStyles = {
    ...styles.splashContainer,
    opacity: isAnimatingOut ? 0 : 1,
    transition: `opacity ${fadeOutDuration}ms ease-out`,
    pointerEvents: isAnimatingOut ? 'none' : 'all'
  };

  if (!showSplash) {
    return children || null;
  }

  return (
    <div style={splashStyles}>
      <LoadingSplash message={message} />
    </div>
  );
};

const styles = {
  splashContainer: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    zIndex: 10000
  }
};

export default LoadingSplashManager;