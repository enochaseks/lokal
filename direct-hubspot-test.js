// For Node.js 18+ use built-in fetch, otherwise use node-fetch package
const fetch = globalThis.fetch || require('node-fetch');

async function testHubSpotAPI() {
  console.log('=== DIRECT HUBSPOT API TEST ===');
  
  // const API_KEY = 'pat-eu1-eec50d2f-2d8c-4b3a-b6aa-dc5a75fae261'; // REMOVED: Do not hardcode secrets
  const API_KEY = process.env.HUBSPOT_API_KEY;
  const API_URL = 'https://api.hubapi.com';
  
  const testEmail = `test-server-${Date.now()}@lokal-app.com`;
  console.log(`Creating test contact with email: ${testEmail}`);
  
  try {
    const response = await fetch(`${API_URL}/crm/v3/objects/contacts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        properties: {
          email: testEmail,
          firstname: 'Test',
          lastname: 'ServerSide'
          // Removed custom properties that don't exist in your HubSpot account
        }
      })
    });
    
    console.log('Response Status:', response.status);
    
    const result = await response.json();
    console.log('Response Body:', JSON.stringify(result, null, 2));
    
    if (response.ok) {
      console.log('SUCCESS! Created contact with ID:', result.id);
    } else {
      console.error('ERROR! Failed to create contact');
      
      if (result.message && result.message.includes('authentication')) {
        console.error('Authentication error - check your API key');
      } else if (result.message && result.message.includes('rate limit')) {
        console.error('Rate limit exceeded');
      }
    }
  } catch (error) {
    console.error('Exception caught:', error);
  }
}

testHubSpotAPI();