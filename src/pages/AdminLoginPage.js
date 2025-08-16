import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

function AdminLoginPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const auth = getAuth();
      const userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;

      // Check if user is an admin
      const adminDoc = await getDoc(doc(db, 'admins', user.uid));
      if (adminDoc.exists()) {
        // User is an admin, redirect to admin dashboard
        navigate('/admin-dashboard');
      } else {
        // Not an admin
        setError('Access denied. Admin credentials required.');
        await auth.signOut();
      }
    } catch (error) {
      console.error('Admin login error:', error);
      setError('Invalid admin credentials');
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
            🔐 Admin Login
          </h1>
          <p style={{ color: '#6B7280' }}>
            Access the admin dashboard
          </p>
        </div>

        <form onSubmit={handleSubmit}>
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
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
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
              placeholder="Enter password"
            />
          </div>

          {error && (
            <div style={{
              backgroundColor: '#FEE2E2',
              border: '1px solid #FECACA',
              color: '#DC2626',
              padding: '0.75rem',
              borderRadius: '6px',
              marginBottom: '1rem',
              fontSize: '0.875rem'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              backgroundColor: loading ? '#9CA3AF' : '#1F2937',
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
            {loading ? 'Signing In...' : 'Sign In as Admin'}
          </button>

          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <button
              onClick={() => navigate('/admin-setup')}
              style={{
                background: 'none',
                border: 'none',
                color: '#6B7280',
                textDecoration: 'underline',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              🛠️ Need to setup admin access?
            </button>
          </div>
        </form>

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
      </div>
    </div>
  );
}

export default AdminLoginPage;
