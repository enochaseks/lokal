# Admin System Setup Guide

## Overview
The Lokal admin system allows designated users to manage customer complaints and view reports. This guide explains how to set up and use the admin features.

## Features
- **Admin Login**: Secure authentication for admin users
- **Admin Dashboard**: View and manage customer complaints with status updates
- **Complaint Management**: Track complaints with customer and shop information
- **Status Updates**: Mark complaints as new, investigating, resolved, or rejected
- **Reports View**: Sellers can view complaints filed against their stores

## Setup Instructions

### 1. Create First Admin User
1. Go to `/admin-setup` in your browser (or click "🛠️ Admin Setup" in the menu)
2. Enter the email and password of an existing user account you want to make admin
3. If the account doesn't exist, first register it normally, then return to admin setup
4. Login with those credentials - the system will check if already an admin
5. If not an admin, enter the admin name and click "Create Admin Access"
6. You'll be automatically redirected to the admin dashboard

### 2. Access Admin Dashboard
- For existing admins: Go to `/admin-login` and login with admin credentials
- After setup: You'll be automatically redirected to the dashboard
- Dashboard URL: `/admin-dashboard`

### 3. Managing Complaints
- View all complaints in the dashboard table
- Click "Manage" on any complaint to:
  - See full details including screenshots
  - View customer and shop information
  - Update complaint status
- Track complaint statistics in the dashboard

## Admin Routes
- `/admin-setup` - Admin creation page (accessible to everyone)
- `/admin-login` - Admin login page (for existing admins)
- `/admin-dashboard` - Main admin management interface

## Database Collections
- `admins` - Stores admin user information and permissions
- `admin_complaints` - Contains all customer complaints with status tracking

## User Types and Access
- **Customers**: Can file complaints through Messages page
- **Sellers**: Can view complaints against their store in Reports page
- **Admins**: Can manage all complaints through admin dashboard

## Security Notes
- Admin setup page is accessible to everyone (intended for initial setup)
- Admins are verified through Firestore `admins` collection
- Only authenticated admin users can access admin routes
- Admin setup page should be secured or removed in production

## Removing Admin Setup in Production
For production deployment, remove or restrict access to `/admin-setup` route in `src/App.js` and remove the admin setup links from the navigation to prevent unauthorized admin creation.

## Support
For issues with the admin system, check the browser console for error messages and ensure the user exists in the `admins` collection with proper permissions.
