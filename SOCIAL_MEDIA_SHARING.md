# Social Media Sharing Implementation for Lokal Store Preview

## Overview
This implementation provides proper social media cards (Open Graph, Twitter Cards) for store preview pages when shared on social platforms like Facebook, Twitter, LinkedIn, and WhatsApp.

## How It Works

### 1. Client-Side Meta Tags
- Added React Helmet to dynamically update meta tags on the client side
- Enhanced `generateShareableStoreCard` function to include detailed store information
- Meta tags include store name, location, opening hours, and category

### 2. Share Modal Improvements
- Updated share modal with direct sharing links to major social platforms:
  - **Facebook**: Direct sharer link with store details
  - **Twitter**: Tweet with store information and relevant hashtags
  - **LinkedIn**: Professional sharing for business networking
  - **WhatsApp**: Share store details via WhatsApp chat
- Added "Copy Link" functionality for easy sharing
- Removed non-functional Instagram/Snapchat buttons and replaced with working alternatives

### 3. Server-Side Solution (For Production)
Created `social-server.js` that:
- Detects social media crawlers (Facebook, Twitter, LinkedIn bots, etc.)
- Serves HTML with proper meta tags for crawlers
- Serves the regular React app for human users
- Includes structured data (JSON-LD) for better SEO

## Files Changed

### `src/pages/StorePreviewPage.js`
- Added React Helmet import
- Enhanced `generateShareableStoreCard` function with detailed store info
- Added dynamic meta tags with Helmet component
- Updated share modal with working social media links
- Added structured data for local business

### `package.json`
- Added react-helmet dependency
- Added new scripts for server-side rendering

### New Files
- `social-server.js`: Express server for handling social media crawlers
- `generate-store-pages.js`: Script to pre-generate static pages for stores

## Usage

### For Development
```bash
npm start
```
The app will run with client-side meta tags.

### For Production (Recommended)
```bash
npm run build
npm run start:server
```
This will:
1. Build the React app
2. Generate static store pages
3. Start the Express server that serves proper meta tags to crawlers

## What Users See When Sharing

When someone shares a store link on social media, the platforms will display:

- **Store Name**: e.g., "Amazing African Store | Food & Groceries on Lokal"
- **Description**: e.g., "Amazing African Store in London, UK. Food & Groceries store. 09:00 - 18:00 today. Find authentic local businesses on Lokal."
- **Image**: Store's background image or logo
- **Hours**: Current day's opening hours or "Closed today"
- **Location**: Store's location

## Technical Details

### Meta Tags Included
- **Open Graph**: For Facebook, LinkedIn, and most social platforms
- **Twitter Cards**: For Twitter sharing
- **Structured Data**: JSON-LD for better SEO and rich snippets

### Crawler Detection
The server detects social media crawlers by checking User-Agent strings for:
- `facebookexternalhit`
- `twitterbot`
- `linkedinbot`
- `whatsapp`
- `telegrambot`
- And others

### Fallback Behavior
- If store data isn't found, falls back to default meta tags
- If the server isn't running, client-side meta tags still work (but may not be crawled properly)

## Testing Social Media Sharing

### Facebook
- Use Facebook's [Sharing Debugger](https://developers.facebook.com/tools/debug/)
- Enter your store URL: `https://yoursite.com/store-preview/STORE_ID`

### Twitter
- Use Twitter's [Card Validator](https://cards-dev.twitter.com/validator)
- Enter your store URL

### LinkedIn
- Use LinkedIn's [Post Inspector](https://www.linkedin.com/post-inspector/)

## Next Steps

1. **Configure Firebase Admin**: Update `social-server.js` and `generate-store-pages.js` with actual Firebase credentials
2. **Deploy Server**: Deploy the Express server to handle social media crawlers
3. **Setup URL Rewriting**: Configure your hosting provider (Netlify, Vercel, etc.) to route store URLs to the server
4. **Test Real Sharing**: Test sharing actual store links on social platforms

## Note for Hosting

If deploying to static hosting (Netlify, Vercel), you'll need to:
1. Deploy the Express server separately (or use serverless functions)
2. Configure redirects to route store preview URLs to the server
3. Ensure the server has access to your Firebase data

This implementation ensures that when store owners or customers share store links, they appear as rich, informative cards on social media platforms, helping drive more traffic and engagement.