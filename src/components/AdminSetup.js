import React, { useState } from 'react';
import { getAuth } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

function AdminSetup() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [adminData, setAdminData] = useState({
    name: '',
    email: ''
  });

  const createAdmin = async () => {
    setLoading(true);
    setMessage('');
    
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user) {
        setMessage('Error: No user is currently logged in');
        setLoading(false);
        return;
      }
      
      if (user.email !== adminData.email) {
        setMessage('Error: Current logged in email does not match provided email');
        setLoading(false);
        return;
      }
      
      // Check if admin already exists
      const adminDoc = await getDoc(doc(db, 'admins', user.uid));
      if (adminDoc.exists()) {
        setMessage('User is already an admin!');
        setLoading(false);
        return;
      }
      
      // Add user to admins collection
      await setDoc(doc(db, 'admins', user.uid), {
        email: adminData.email,
        name: adminData.name,
        role: 'admin',
        createdAt: new Date(),
        permissions: ['manage_complaints', 'view_reports', 'user_management']
      });
      
      setMessage('✅ Admin user created successfully! You can now access the admin dashboard.');
      
    } catch (error) {
      console.error('Error creating admin user:', error);
      setMessage('Error: ' + error.message);
    }
    setLoading(false);
  };

  return (
    <div style={{
      backgroundColor: '#FFF3CD',
      border: '1px solid #FFEAA7',
      borderRadius: '8px',
      padding: '1.5rem',
      margin: '1rem',
      maxWidth: '500px'
    }}>
      <h3 style={{ color: '#856404', margin: '0 0 1rem 0' }}>
        🛠️ Admin Setup (Development Only)
      </h3>
      
      <p style={{ color: '#856404', fontSize: '0.875rem', marginBottom: '1rem' }}>
        This tool creates admin access for the currently logged-in user. 
        Remove this component in production.
      </p>
      
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#856404' }}>
          Admin Name:
        </label>
        <input
          type="text"
          value={adminData.name}
          onChange={(e) => setAdminData(prev => ({ ...prev, name: e.target.value }))}
          style={{
            width: '100%',
            padding: '0.5rem',
            border: '1px solid #FFEAA7',
            borderRadius: '4px',
            boxSizing: 'border-box'
          }}
          placeholder="Enter admin name"
        />
      </div>
      
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#856404' }}>
          Admin Email (must match current user):
        </label>
        <input
          type="email"
          value={adminData.email}
          onChange={(e) => setAdminData(prev => ({ ...prev, email: e.target.value }))}
          style={{
            width: '100%',
            padding: '0.5rem',
            border: '1px solid #FFEAA7',
            borderRadius: '4px',
            boxSizing: 'border-box'
          }}
          placeholder="Enter admin email"
        />
      </div>
      
      <button
        onClick={createAdmin}
        disabled={loading || !adminData.name || !adminData.email}
        style={{
          backgroundColor: loading ? '#6C757D' : '#007B7F',
          color: 'white',
          border: 'none',
          padding: '0.75rem 1.5rem',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontWeight: 'bold'
        }}
      >
        {loading ? 'Creating Admin...' : 'Create Admin Access'}
      </button>
      
      {message && (
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem',
          borderRadius: '4px',
          backgroundColor: message.includes('Error') ? '#F8D7DA' : '#D4EDDA',
          color: message.includes('Error') ? '#721C24' : '#155724',
          border: message.includes('Error') ? '1px solid #F5C6CB' : '1px solid #C3E6CB'
        }}>
          {message}
        </div>
      )}
    </div>
  );
}

export default AdminSetup;
