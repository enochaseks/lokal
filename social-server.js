const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// Serve static files from the React app build directory
app.use(express.static(path.join(__dirname, 'build')));

// Template HTML for store pages with dynamic meta tags
const getStorePageHTML = (storeData) => {
  if (!storeData) {
    // Return default HTML if store not found
    return fs.readFileSync(path.join(__dirname, 'build', 'index.html'), 'utf8');
  }

  const storeName = storeData.storeName || storeData.businessName || 'Local Store';
  const storeLocation = storeData.storeLocation || 'Local Area';
  const storeCategory = storeData.category || 'Local Business';
  const storeImage = storeData.backgroundImg || storeData.logoImg || 'https://lokalshops.co.uk/logo512.jpg';
  const storeUrl = `https://lokalshops.co.uk/store-preview/${storeData.id}`;
  
  // Get opening hours info
  const today = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
  let hoursInfo = '';
  
  if (storeData.closedDays && storeData.closedDays.includes(today)) {
    hoursInfo = 'Closed today';
  } else {
    const todayOpening = storeData.openingTimes && storeData.openingTimes[today];
    const todayClosing = storeData.closingTimes && storeData.closingTimes[today];
    const opening = todayOpening || storeData.openingTime;
    const closing = todayClosing || storeData.closingTime;
    
    if (opening && closing) {
      hoursInfo = `${opening} - ${closing} today`;
    } else {
      hoursInfo = 'Hours available in store';
    }
  }
  
  const description = `${storeName} in ${storeLocation}. ${storeCategory} store. ${hoursInfo}. Find authentic local businesses on Lokal.`;
  
  // Read the base HTML file
  let html = fs.readFileSync(path.join(__dirname, 'build', 'index.html'), 'utf8');
  
  // Replace the default meta tags with store-specific ones
  html = html.replace(
    /<title>.*?<\/title>/,
    `<title>${storeName} | ${storeCategory} on Lokal</title>`
  );
  
  html = html.replace(
    /<meta name="title" content=".*?" \/>/,
    `<meta name="title" content="${storeName} | ${storeCategory} on Lokal" />`
  );
  
  html = html.replace(
    /<meta name="description" content=".*?" \/>/,
    `<meta name="description" content="${description}" />`
  );
  
  // Update Open Graph tags
  html = html.replace(
    /<meta property="og:title" content=".*?" \/>/,
    `<meta property="og:title" content="${storeName} | ${storeCategory} on Lokal" />`
  );
  
  html = html.replace(
    /<meta property="og:description" content=".*?" \/>/,
    `<meta property="og:description" content="${description}" />`
  );
  
  html = html.replace(
    /<meta property="og:image" content=".*?" \/>/,
    `<meta property="og:image" content="${storeImage}" />`
  );
  
  html = html.replace(
    /<meta property="og:url" content=".*?" \/>/,
    `<meta property="og:url" content="${storeUrl}" />`
  );
  
  // Update Twitter tags
  html = html.replace(
    /<meta property="twitter:title" content=".*?" \/>/,
    `<meta property="twitter:title" content="${storeName} | ${storeCategory} on Lokal" />`
  );
  
  html = html.replace(
    /<meta property="twitter:description" content=".*?" \/>/,
    `<meta property="twitter:description" content="${description}" />`
  );
  
  html = html.replace(
    /<meta property="twitter:image" content=".*?" \/>/,
    `<meta property="twitter:image" content="${storeImage}" />`
  );
  
  // Add structured data for the store
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": storeName,
    "description": description,
    "url": storeUrl,
    "address": {
      "@type": "PostalAddress",
      "addressLocality": storeLocation,
      "addressCountry": "GB"
    },
    "category": storeCategory,
    "image": storeImage,
    "openingHours": hoursInfo !== 'Hours available in store' ? hoursInfo : undefined,
    "isAccessibleForFree": true,
    "currenciesAccepted": "GBP",
    "paymentAccepted": "Cash, Credit Card",
    "priceRange": "$$"
  };
  
  // Add the structured data script before closing head tag
  html = html.replace(
    '</head>',
    `<script type="application/ld+json">${JSON.stringify(structuredData, null, 2)}</script>\n</head>`
  );
  
  return html;
};

// Mock function to get store data (replace with actual Firebase call)
const getStoreData = async (storeId) => {
  // TODO: Replace with actual Firebase Firestore call
  // const admin = require('firebase-admin');
  // const db = admin.firestore();
  // const storeDoc = await db.collection('stores').doc(storeId).get();
  // return storeDoc.exists ? { id: storeDoc.id, ...storeDoc.data() } : null;
  
  // Mock data for testing
  if (storeId === 'sample-store') {
    return {
      id: 'sample-store',
      storeName: 'Sample African Store',
      storeLocation: 'London, UK',
      category: 'Food & Groceries',
      openingTime: '09:00',
      closingTime: '18:00',
      backgroundImg: 'https://lokalshops.co.uk/logo512.jpg'
    };
  }
  
  return null;
};

// Handle store preview routes for social media crawlers
app.get('/store-preview/:storeId', async (req, res) => {
  const { storeId } = req.params;
  const userAgent = req.get('User-Agent') || '';
  
  // Check if it's a social media crawler
  const isCrawler = /facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|applebot|googlebot|bingbot|slackbot|discordbot/i.test(userAgent);
  
  if (isCrawler) {
    try {
      const storeData = await getStoreData(storeId);
      const html = getStorePageHTML(storeData);
      res.send(html);
    } catch (error) {
      console.error('Error fetching store data:', error);
      res.sendFile(path.join(__dirname, 'build', 'index.html'));
    }
  } else {
    // For regular users, serve the React app
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
  }
});

// Handle all other routes - send back React's index.html file
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Social media crawlers will get proper meta tags for store pages`);
});

module.exports = app;