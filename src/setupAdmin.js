// Admin Setup Script
// This script helps create the first admin user in Firestore
// Run this in the browser console when logged in as the intended admin user

import { getAuth } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export const createAdminUser = async (email, name) => {
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user) {
      console.error('No user is currently logged in');
      return;
    }
    
    if (user.email !== email) {
      console.error('Current user email does not match provided email');
      return;
    }
    
    // Add user to admins collection
    await setDoc(doc(db, 'admins', user.uid), {
      email: email,
      name: name,
      role: 'admin',
      createdAt: new Date(),
      permissions: ['manage_complaints', 'view_reports', 'user_management']
    });
    
    console.log('Admin user created successfully:', email);
    alert('Admin user created successfully! You can now access the admin dashboard.');
    
  } catch (error) {
    console.error('Error creating admin user:', error);
    alert('Error creating admin user: ' + error.message);
  }
};

// Usage example:
// createAdminUser('admin@lokal.com', 'Admin User');
