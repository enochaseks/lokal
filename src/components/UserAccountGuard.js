import { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate, useLocation } from 'react-router-dom';

const UserAccountGuard = ({ children }) => {
  const [isChecking, setIsChecking] = useState(true);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  
  useEffect(() => {
    const auth = getAuth();
    
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        
        // Set up Firestore document listener for this user
        const userDocRef = doc(db, 'users', currentUser.uid);
        
        const unsubscribeDoc = onSnapshot(
          userDocRef,
          (docSnapshot) => {
            if (!docSnapshot.exists()) {
              // User document has been deleted - sign out and redirect
              console.log('User document deleted - signing out user');
              
              signOut(auth).then(() => {
                // Show alert before redirecting
                alert(
                  '⚠️ Account Deleted\n\n' +
                  'Your account has been deleted by an administrator.\n' +
                  'You will be redirected to the login page.'
                );
                
                // Redirect to login page
                navigate('/login', { replace: true });
              }).catch((error) => {
                console.error('Error signing out:', error);
                // Force redirect even if signout fails
                navigate('/login', { replace: true });
              });
            }
            setIsChecking(false);
          },
          (error) => {
            console.error('Error monitoring user document:', error);
            setIsChecking(false);
          }
        );
        
        // Return cleanup function for document listener
        return () => unsubscribeDoc();
      } else {
        setUser(null);
        setIsChecking(false);
      }
    });
    
    // Cleanup auth listener
    return () => unsubscribeAuth();
  }, [navigate]);
  
  // Don't monitor on public pages
  const publicPages = ['/login', '/register', '/admin-login', '/admin-setup'];
  const isPublicPage = publicPages.some(page => location.pathname.startsWith(page));
  
  if (isPublicPage) {
    return children;
  }
  
  // Show loading state while checking
  if (isChecking) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f9fafb'
      }}>
        <div style={{
          textAlign: 'center',
          padding: '2rem'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #e5e7eb',
            borderTop: '4px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }}></div>
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
            Verifying account status...
          </p>
        </div>
      </div>
    );
  }
  
  return children;
};

// Add spinner animation
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);

export default UserAccountGuard;