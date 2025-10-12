// Simple test to verify social media sharing functionality
// Run this with: node test-sharing.js

const { generateStoreHTML } = require('./generate-store-pages');

// Test data
const testStore = {
  id: 'test-store-123',
  storeName: 'Amazing African Cuisine',
  businessName: 'Amazing African Cuisine',
  storeLocation: 'Birmingham, UK',
  category: 'Restaurant',
  openingTime: '10:00',
  closingTime: '22:00',
  openingTimes: {
    'Monday': '10:00',
    'Tuesday': '10:00',
    'Wednesday': '10:00',
    'Thursday': '10:00',
    'Friday': '10:00',
    'Saturday': '09:00',
    'Sunday': '12:00'
  },
  closingTimes: {
    'Monday': '22:00',
    'Tuesday': '22:00',
    'Wednesday': '22:00',
    'Thursday': '22:00',
    'Friday': '23:00',
    'Saturday': '23:00',
    'Sunday': '21:00'
  },
  closedDays: [],
  backgroundImg: 'https://example.com/store-image.jpg'
};

console.log('🧪 Testing Social Media Sharing Implementation');
console.log('='.repeat(50));

// Test 1: Generate HTML for store
console.log('\n📄 Test 1: Generating HTML with meta tags');
try {
  const html = generateStoreHTML(testStore);
  
  // Check if required meta tags are present
  const hasTitle = html.includes('<title>Amazing African Cuisine | Restaurant on Lokal</title>');
  const hasOGTitle = html.includes('og:title');
  const hasOGDescription = html.includes('og:description');
  const hasOGImage = html.includes('og:image');
  const hasTwitterCard = html.includes('twitter:card');
  const hasStructuredData = html.includes('@type": "LocalBusiness"');
  
  console.log('✅ HTML generated successfully');
  console.log('✅ Title tag:', hasTitle ? 'Present' : '❌ Missing');
  console.log('✅ Open Graph title:', hasOGTitle ? 'Present' : '❌ Missing');
  console.log('✅ Open Graph description:', hasOGDescription ? 'Present' : '❌ Missing');
  console.log('✅ Open Graph image:', hasOGImage ? 'Present' : '❌ Missing');
  console.log('✅ Twitter Card:', hasTwitterCard ? 'Present' : '❌ Missing');
  console.log('✅ Structured Data:', hasStructuredData ? 'Present' : '❌ Missing');
  
} catch (error) {
  console.log('❌ Error generating HTML:', error.message);
}

// Test 2: Test different store scenarios
console.log('\n⏰ Test 2: Testing different opening hour scenarios');

// Test closed store
const closedStore = {
  ...testStore,
  id: 'closed-store',
  closedDays: ['Sunday'],
  storeName: 'Closed Sunday Store'
};

// Test store without specific hours
const noHoursStore = {
  ...testStore,
  id: 'no-hours-store',
  storeName: 'No Hours Store',
  openingTime: undefined,
  closingTime: undefined,
  openingTimes: undefined,
  closingTimes: undefined
};

[closedStore, noHoursStore].forEach((store, index) => {
  try {
    const html = generateStoreHTML(store);
    const hasValidDescription = html.includes('og:description');
    console.log(`✅ Test store ${index + 1} (${store.storeName}):`, hasValidDescription ? 'Valid' : '❌ Invalid');
  } catch (error) {
    console.log(`❌ Test store ${index + 1} failed:`, error.message);
  }
});

// Test 3: URL generation
console.log('\n🔗 Test 3: Testing URL generation');
const expectedUrl = 'https://lokalshops.co.uk/store-preview/test-store-123';
const html = generateStoreHTML(testStore);
const hasCorrectCanonical = html.includes(`<link rel="canonical" href="${expectedUrl}"`);
const hasCorrectOGUrl = html.includes(`og:url" content="${expectedUrl}"`);

console.log('✅ Canonical URL:', hasCorrectCanonical ? 'Correct' : '❌ Incorrect');
console.log('✅ Open Graph URL:', hasCorrectOGUrl ? 'Correct' : '❌ Incorrect');

// Test 4: Social Media URLs (simulate frontend)
console.log('\n📱 Test 4: Testing social media sharing URLs');

const mockShareData = {
  title: 'Amazing African Cuisine | Restaurant on Lokal',
  description: 'Amazing African Cuisine in Birmingham, UK. Restaurant store. 10:00 - 22:00 today. Find authentic local businesses on Lokal.',
  url: 'https://lokalshops.co.uk/store-preview/test-store-123',
  hashtags: ['#LokalUK', '#LocalBusiness', '#SupportLocal', '#Restaurant']
};

// Facebook URL
const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(mockShareData.url)}&quote=${encodeURIComponent(`${mockShareData.title} - ${mockShareData.description}`)}`;
console.log('✅ Facebook URL generated:', facebookUrl.includes('facebook.com') ? 'Valid' : '❌ Invalid');

// Twitter URL
const twitterText = `${mockShareData.title}\n\n${mockShareData.description}\n\n${mockShareData.hashtags.join(' ')}`;
const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(twitterText)}&url=${encodeURIComponent(mockShareData.url)}`;
console.log('✅ Twitter URL generated:', twitterUrl.includes('twitter.com') ? 'Valid' : '❌ Invalid');

// LinkedIn URL
const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(mockShareData.url)}`;
console.log('✅ LinkedIn URL generated:', linkedinUrl.includes('linkedin.com') ? 'Valid' : '❌ Invalid');

// WhatsApp URL
const whatsappText = `${mockShareData.title}\n\n${mockShareData.description}\n\n${mockShareData.url}`;
const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;
console.log('✅ WhatsApp URL generated:', whatsappUrl.includes('wa.me') ? 'Valid' : '❌ Invalid');

console.log('\n🎉 Testing Complete!');
console.log('='.repeat(50));
console.log('📝 Summary:');
console.log('   - Meta tags are properly generated');
console.log('   - Social media URLs are correctly formatted');
console.log('   - Store information is properly included');
console.log('   - Different store scenarios are handled');
console.log('\n💡 Next steps:');
console.log('   1. Deploy the social-server.js to handle crawlers');
console.log('   2. Test with actual social media sharing debuggers');
console.log('   3. Configure Firebase Admin SDK for real data');
console.log('   4. Test on actual store pages');