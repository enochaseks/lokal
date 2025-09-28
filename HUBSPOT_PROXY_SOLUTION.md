# HubSpot Integration with Backend Proxy

I've fixed the CORS issues by implementing a backend proxy approach. Here's what I've done:

## 1. Root Cause Identified: CORS Restrictions

The issue we were experiencing is due to CORS (Cross-Origin Resource Sharing) restrictions. Browsers prevent JavaScript from making direct API calls to third-party services like HubSpot from a different domain (such as localhost or your production domain).

## 2. Solution Implemented: Backend Proxy

The solution is to:
- Make API calls to your own backend
- Have your backend make the API calls to HubSpot
- Return the results to your frontend

This way the browser's CORS restrictions are not triggered.

## 3. Implementation Details

### Backend Changes:
1. Created a new route handler at `/src/backend/routes/hubspot.js`
2. Added the route to the Express server in `/src/backend/server.js`
3. Added the HubSpot API key to the backend `.env` file

### Frontend Changes:
1. Updated the HubSpot client to call our backend proxy instead of the HubSpot API directly
2. Simplified the code to rely on the backend for the heavy lifting
3. Improved error handling and logging

## 4. How to Test

1. Run the backend server:
```
cd src/backend
node server.js
```

2. Make sure your frontend is pointing to the correct backend:
   - For local development: `REACT_APP_API_URL=http://localhost:3001`
   - For production: `REACT_APP_API_URL=https://lokal-rqpx.onrender.com`

3. Test the HubSpot integration:
   - Register a new user with marketing consent checked
   - Check in Settings > Communications Preferences and toggle the consent
   - Use the "Test Direct HubSpot API" button

## 5. Additional Notes

- The backend now stores marketing consent in a note field on the contact
- To create custom properties in HubSpot, follow the instructions in HUBSPOT_CUSTOM_PROPERTIES.md
- This approach is more secure as API keys are only stored on the server, not in client-side code