const fs = require('fs');
const path = require('path');

// Firebase Admin SDK setup (you'll need to configure this with your service account)
const admin = require('firebase-admin');

// Initialize Firebase Admin (you need to add your service account key)
// const serviceAccount = require('./firebase-admin-key.json');
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
//   databaseURL: 'your-firebase-database-url'
// });

// For now, we'll create a template that can be used
const generateStoreHTML = (storeData) => {
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
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <link rel="icon" href="/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, shrink-to-fit=no, maximum-scale=1, user-scalable=no" />
    <meta name="theme-color" content="#000000" />
    
    <!-- Primary SEO Meta Tags -->
    <title>${storeName} | ${storeCategory} on Lokal</title>
    <meta name="title" content="${storeName} | ${storeCategory} on Lokal" />
    <meta name="description" content="${description}" />
    <meta name="keywords" content="${storeName}, ${storeCategory}, african businesses, caribbean shops, black owned businesses, local stores, ${storeLocation}" />
    <meta name="robots" content="index, follow" />
    <meta name="language" content="English" />
    <meta name="author" content="Lokal" />

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="business.business" />
    <meta property="og:url" content="${storeUrl}" />
    <meta property="og:title" content="${storeName} | ${storeCategory} on Lokal" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${storeImage}" />
    <meta property="og:site_name" content="Lokal" />
    <meta property="og:locale" content="en_GB" />
    
    <!-- Additional Open Graph business data -->
    <meta property="business:contact_data:locality" content="${storeLocation}" />
    <meta property="business:contact_data:country_name" content="United Kingdom" />
    
    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:url" content="${storeUrl}" />
    <meta property="twitter:title" content="${storeName} | ${storeCategory} on Lokal" />
    <meta property="twitter:description" content="${description}" />
    <meta property="twitter:image" content="${storeImage}" />
    
    <!-- Canonical URL -->
    <link rel="canonical" href="${storeUrl}" />
    
    <!-- Structured Data for Business -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "name": "${storeName}",
      "description": "${description}",
      "url": "${storeUrl}",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "${storeLocation}",
        "addressCountry": "GB"
      },
      "category": "${storeCategory}",
      "image": "${storeImage}",
      "openingHours": "${hoursInfo !== 'Hours available in store' ? hoursInfo : ''}",
      "isAccessibleForFree": true,
      "currenciesAccepted": "GBP",
      "paymentAccepted": "Cash, Credit Card",
      "priceRange": "$$"
    }
    </script>
    
    <!-- Redirect to main app -->
    <script>
      // Redirect to the main React app after a brief delay to allow crawlers to read meta tags
      setTimeout(function() {
        if (typeof window !== 'undefined' && !window.location.hash) {
          window.location.href = '/#/store-preview/${storeData.id}';
        }
      }, 100);
    </script>
    
    <link rel="manifest" href="/manifest.json" />
</head>
<body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    
    <!-- Fallback content for crawlers -->
    <div id="store-preview-fallback" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1>${storeName}</h1>
        <p><strong>Category:</strong> ${storeCategory}</p>
        <p><strong>Location:</strong> ${storeLocation}</p>
        <p><strong>Hours:</strong> ${hoursInfo}</p>
        <p>${description}</p>
        <p><a href="/#/store-preview/${storeData.id}">Visit Store on Lokal →</a></p>
    </div>
    
    <div id="root"></div>
    
    <!-- Load main React app -->
    <script src="/static/js/bundle.js"></script>
</body>
</html>`;
};

// Function to generate pages for all stores (you would call this with actual store data)
const generateAllStorePages = async () => {
  try {
    // This is where you would fetch all stores from Firebase
    // const db = admin.firestore();
    // const storesSnapshot = await db.collection('stores').get();
    
    // For now, we'll create a sample
    const sampleStore = {
      id: 'sample-store',
      storeName: 'Sample African Store',
      storeLocation: 'London, UK',
      category: 'Food & Groceries',
      openingTime: '09:00',
      closingTime: '18:00',
      backgroundImg: 'https://lokalshops.co.uk/logo512.jpg'
    };
    
    const html = generateStoreHTML(sampleStore);
    
    // Create build/store-preview directory
    const storeDir = path.join(__dirname, 'build', 'store-preview');
    if (!fs.existsSync(storeDir)) {
      fs.mkdirSync(storeDir, { recursive: true });
    }
    
    // Write the HTML file
    fs.writeFileSync(path.join(storeDir, `${sampleStore.id}.html`), html);
    
    console.log(`Generated static page for store: ${sampleStore.id}`);
    
    // TODO: Implement actual Firebase fetching
    // storesSnapshot.forEach((doc) => {
    //   const storeData = { id: doc.id, ...doc.data() };
    //   const html = generateStoreHTML(storeData);
    //   fs.writeFileSync(path.join(storeDir, `${storeData.id}.html`), html);
    //   console.log(`Generated static page for store: ${storeData.id}`);
    // });
    
  } catch (error) {
    console.error('Error generating store pages:', error);
  }
};

// Export for use in build process
module.exports = { generateStoreHTML, generateAllStorePages };

// Run if called directly
if (require.main === module) {
  generateAllStorePages();
}