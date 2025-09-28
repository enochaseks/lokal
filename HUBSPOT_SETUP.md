# HubSpot Configuration
To complete the HubSpot integration, you need to:

1. Sign up for a HubSpot account if you don't have one already (https://app.hubspot.com/signup)
2. Create a private app in HubSpot to get API keys:
   - Go to Settings > Integrations > Private Apps
   - Create a new private app with the name "Lokal App"
   - Add the following scopes:
     - crm.objects.contacts.read
     - crm.objects.contacts.write
   - Create the app and copy the access token

3. Add the API key to your .env file:
   ```
   REACT_APP_HUBSPOT_API_KEY=your_hubspot_api_key_here
   ```

4. Restart your development server

## Testing the integration
Once configured, you can test the integration by:
1. Registering a new user with the marketing consent checkbox checked
2. Going to HubSpot to verify the contact was created
3. Updating preferences in the Communications Preferences page
4. Verifying the changes were reflected in HubSpot

## Troubleshooting
- If you see 401 errors, check that your API key is correct
- If contacts aren't being created, check the browser console for errors

## Notes for Production
- For production, ensure your API key is set in your hosting environment
- Consider implementing rate limiting for HubSpot API calls
- Monitor API usage to stay within HubSpot's limits for your plan