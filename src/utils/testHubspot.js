// src/utils/testHubspot.js
import { addOrUpdateContact } from './hubspotClient';

/**
 * Tests the HubSpot integration by creating or updating a test contact
 * @returns {Promise<boolean>} Whether the test was successful
 */
export const testHubspotConnection = async () => {
  console.log('Testing HubSpot connection...');
  
  // Create a test contact with a timestamp in the email to ensure uniqueness
  const testEmail = `test-${Date.now()}@lokal-test.com`;
  
  const result = await addOrUpdateContact({
    email: testEmail,
    firstName: 'Test',
    lastName: 'User',
    marketingConsent: true
  });
  
  console.log('HubSpot test result:', result);
  return result;
};