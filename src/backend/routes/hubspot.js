// src/backend/routes/hubspot.js
const express = require('express');
const router = express.Router();
// Use dynamic import for node-fetch (ESM compatibility)
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// HubSpot API configuration
const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
// Use EU region API URL since your API key starts with pat-eu1-
const HUBSPOT_API_URL = 'https://api.hubapi.com'; // HubSpot now uses same base URL for all regions

// Proxy endpoint to create or update a contact
router.post('/contact', async (req, res) => {
  try {
    const { email, firstName, lastName, marketingConsent } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }
    
    console.log(`Processing contact: ${email}`);
    
    // Check if contact exists
    const searchResponse = await fetch(
      `${HUBSPOT_API_URL}/crm/v3/objects/contacts/search`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${HUBSPOT_API_KEY}`
        },
        body: JSON.stringify({
          filterGroups: [
            {
              filters: [
                {
                  propertyName: 'email',
                  operator: 'EQ',
                  value: email
                }
              ]
            }
          ]
        })
      }
    );
    
    const searchData = await searchResponse.json();
    let hubspotResponse;
    
    // Create properties object with standard HubSpot fields
    const properties = {
      email: email
    };
    
    // Add optional properties if provided
    if (firstName) properties.firstname = firstName;
    if (lastName) properties.lastname = lastName;
    
    // Store marketing consent in standard HubSpot properties
    if (marketingConsent !== undefined) {
      // Use ONLY standard HubSpot properties that exist in all accounts
      properties.hs_lead_status = marketingConsent ? 'Marketing Qualified Lead' : 'Subscriber';
      
      // The lokal_marketing_consent property might not exist in your HubSpot account
      // Don't use custom properties until they're created in HubSpot
      // properties.lokal_marketing_consent = marketingConsent ? 'Yes' : 'No';
    }
    
    // Log the properties we're about to send
    console.log('Sending properties to HubSpot:', properties);
    
    if (searchData.results && searchData.results.length > 0) {
      // Contact exists, update it
      const contactId = searchData.results[0].id;
      
      hubspotResponse = await fetch(
        `${HUBSPOT_API_URL}/crm/v3/objects/contacts/${contactId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${HUBSPOT_API_KEY}`
          },
          body: JSON.stringify({
            properties: properties
          })
        }
      );
    } else {
      // Contact doesn't exist, create it
      hubspotResponse = await fetch(
        `${HUBSPOT_API_URL}/crm/v3/objects/contacts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${HUBSPOT_API_KEY}`
          },
          body: JSON.stringify({
            properties: properties
          })
        }
      );
    }
    
    const result = await hubspotResponse.json();
    
    if (hubspotResponse.ok) {
      console.log(`HubSpot contact ${searchData.results ? 'updated' : 'created'} successfully`);
      return res.json({ success: true, data: result });
    } else {
      console.error('HubSpot API error:', result);
      return res.status(hubspotResponse.status).json({ 
        success: false, 
        message: result.message || 'HubSpot API error',
        error: result 
      });
    }
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error', 
      error: error.message 
    });
  }
});

module.exports = router;