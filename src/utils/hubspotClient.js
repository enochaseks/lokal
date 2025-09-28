// Browser-compatible HubSpot client implementation
// Uses our backend proxy to avoid CORS issues

// Get the backend API URL from environment variables or use default
// For development, prefer localhost if we're running locally
const isDevelopment = process.env.NODE_ENV === 'development';
const DEFAULT_API_URL = isDevelopment ? 'http://localhost:3001' : 'https://lokal-rqpx.onrender.com';
const API_URL = process.env.REACT_APP_API_URL || DEFAULT_API_URL;
const HUBSPOT_PROXY_URL = `${API_URL}/api/hubspot`;

// Debug flag - set to true to see detailed logs
const DEBUG = true;

/**
 * Add or update a contact in HubSpot
 * @param {Object} contactData - Contact information
 * @param {string} contactData.email - Email address
 * @param {string} contactData.firstName - First name (optional)
 * @param {string} contactData.lastName - Last name (optional)
 * @param {boolean} contactData.marketingConsent - Whether the user has consented to marketing
 * @returns {Promise<boolean>} - Whether the operation was successful
 */
export const addOrUpdateContact = async (contactData) => {
  try {
    if (DEBUG) console.log('HubSpot: Adding/updating contact via proxy', contactData);

    const { email, firstName, lastName, marketingConsent } = contactData;
    
    if (!email) {
      console.error('HubSpot: No email provided');
      return false;
    }
    
    // Send the request to our backend proxy instead of directly to HubSpot
    const response = await fetch(`${HUBSPOT_PROXY_URL}/contact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        firstName,
        lastName,
        marketingConsent
      }),
      credentials: 'include', // Include cookies if needed
      mode: 'cors' // Explicitly request CORS mode
    });

    const responseData = await response.json();
    
    if (DEBUG) console.log('HubSpot proxy response:', responseData);
    
    // Accept 200 OK responses where the backend returns success:true
    // This is for cases where the backend decides to skip an update because no changes are needed
    if (responseData.success === true) {
      if (DEBUG) {
        console.log('HubSpot: Operation successful via proxy');
        
        // If we have contact details, display them
        if (responseData.data && responseData.data.contactDetails) {
          console.log('HubSpot contact details:', responseData.data.contactDetails);
        }
        
        // If there was a message like "No changes needed", display it
        if (responseData.data && responseData.data.message) {
          console.log('HubSpot message:', responseData.data.message);
        }
      }
      return true;
    }
    
    // Handle error cases
    if (!response.ok) {
      // Special handling for property already having the same value (not a real error)
      if (responseData.error && responseData.message && 
          responseData.message.includes('already has that value')) {
        console.log('HubSpot: Property already had that value, no change needed');
        return true;
      }
      
      console.error('HubSpot: Error from proxy server:', responseData);
      return false;
    }
    
    if (DEBUG) console.log('HubSpot: Operation successful via proxy');
    return true;
  } catch (error) {
    console.error('Error updating HubSpot contact:', error);
    return false;
  }
};

/**
 * Update marketing consent status for a contact
 * @param {string} email - Contact email
 * @param {boolean} consent - New consent status
 * @returns {Promise<boolean>} - Whether the operation was successful
 */
export const updateMarketingConsent = async (email, consent) => {
  try {
    if (DEBUG) console.log('HubSpot: Updating marketing consent for', email, 'to', consent);
    
    if (!email) {
      console.error('HubSpot: No email provided for marketing consent update');
      return false;
    }
    
    // Just pass through to addOrUpdateContact which now uses our proxy
    const result = await addOrUpdateContact({ 
      email: email,
      marketingConsent: consent
    });
    
    if (DEBUG) console.log('HubSpot: Consent update result:', result);
    return result;
  } catch (error) {
    console.error('HubSpot: Error updating marketing consent:', error);
    return false;
  }
};

// Export a dummy client for backward compatibility
const hubspotClient = {
  isLegacyClient: true
};

export default hubspotClient;