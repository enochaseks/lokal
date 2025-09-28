# Setting Up Custom Properties in HubSpot

For full marketing consent functionality, you need to create custom properties in HubSpot. Here's how to set them up:

## 1. Log into HubSpot
Log into your HubSpot account at [app.hubspot.com](https://app.hubspot.com)

## 2. Access Property Settings
1. Click on the Settings gear icon in the top right corner
2. In the left sidebar, click "Properties"
3. Make sure "Contact properties" is selected

## 3. Create Lokal Marketing Consent Property
1. Click "Create property" button
2. Fill in the following details:
   - Object type: Contact
   - Group: Contact Information
   - Property name: lokal_marketing_consent
   - Label: Lokal Marketing Consent
   - Description: Whether the user has consented to marketing communications from Lokal
   - Field type: Single checkbox
3. Click "Create"

## 4. Create Consent Timestamp Property
1. Click "Create property" button again
2. Fill in the following details:
   - Object type: Contact
   - Group: Contact Information
   - Property name: lokal_marketing_consent_timestamp
   - Label: Lokal Marketing Consent Timestamp
   - Description: When the user last updated their marketing consent
   - Field type: Date picker
3. Click "Create"

## 5. Update the HubSpot Client Code
Once these properties are created, you can update the hubspotClient.js file to use them:

```javascript
// In src/utils/hubspotClient.js
const properties = {
  email: email,
  lokal_marketing_consent: marketingConsent ? 'true' : 'false', 
  lokal_marketing_consent_timestamp: new Date().toISOString()
};
```

## 6. Test the Integration
After setting up the custom properties and updating the code, test the integration again to ensure it's working properly.

Note: Property changes in HubSpot may take a few minutes to take effect.