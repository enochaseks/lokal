// Direct test for HubSpot API
// Run this with: node test-hubspot.js

require('dotenv').config(); // Load environment variables from .env file

console.log('Testing HubSpot API connection');

// Check if API key is available
const apiKey = process.env.REACT_APP_HUBSPOT_API_KEY;
console.log('API Key available:', !!apiKey);
if (apiKey) {
  console.log('API Key starts with:', apiKey.substring(0, 8) + '...');
}

// Test function to create a contact directly
async function createTestContact() {
  const email = `test-${Date.now()}@lokal-app.com`;
  
  try {
    console.log(`Creating test contact with email: ${email}`);
    
    const response = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        properties: {
          email: email,
          firstname: 'Test',
          lastname: 'User',
          lokal_marketing_consent: 'true',
          hs_email_marketing_consent_status: 'OPTED_IN'
        }
      })
    });
    
    const result = await response.json();
    console.log('Response status:', response.status);
    console.log('Response body:', JSON.stringify(result, null, 2));
    
    return response.ok;
  } catch (error) {
    console.error('Error creating contact:', error);
    return false;
  }
}

// Run the test
createTestContact()
  .then(success => {
    console.log('Test completed with result:', success ? 'SUCCESS' : 'FAILED');
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
  });