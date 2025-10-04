// Country detection utility for payment provider selection

export const detectUserCountry = async () => {
  try {
    console.log('🌍 Starting multi-method country detection...');
    let countryCode = null;
    let detectionMethod = 'unknown';
    
    // Method 1: Try Google Maps Geolocation API (most accurate) - with timeout
    if (window.google && window.google.maps) {
      try {
        console.log('🗺️ Trying Google Maps geolocation...');
        
        // Use geolocation with reasonable timeout
        const position = await getCurrentPosition();
        const geocoder = new window.google.maps.Geocoder();
        
        const geocodeResult = await new Promise((resolve, reject) => {
          const geocodeTimeout = setTimeout(() => {
            reject(new Error('Geocoding timeout'));
          }, 2000);
          
          geocoder.geocode(
            { location: { lat: position.coords.latitude, lng: position.coords.longitude } },
            (results, status) => {
              clearTimeout(geocodeTimeout);
              if (status === 'OK' && results[0]) {
                resolve(results[0]);
              } else {
                reject(new Error('Geocoding failed: ' + status));
              }
            }
          );
        });
        
        // Extract country code from Google Maps result
        const countryComponent = geocodeResult.address_components.find(
          component => component.types.includes('country')
        );
        
        if (countryComponent) {
          countryCode = countryComponent.short_name;
          detectionMethod = 'google_maps';
          console.log('✅ Google Maps detected country:', countryCode);
        }
      } catch (err) {
        console.warn('🗺️ Google Maps geolocation failed:', err);
      }
    } else {
      console.warn('🗺️ Google Maps API not available');
    }
    
    // Method 2: Try browser geolocation with reverse geocoding - with timeout
    if (!countryCode) {
      try {
        console.log('📍 Trying browser geolocation...');
        
        // Use browser geolocation with reasonable timeout
        const position = await getCurrentPosition();
        
        // Add timeout to geocoding API
        const geocodePromise = fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${position.coords.latitude}&longitude=${position.coords.longitude}&localityLanguage=en`
        );
        const geocodeTimeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Geocoding API timeout')), 2000)
        );
        
        const response = await Promise.race([geocodePromise, geocodeTimeoutPromise]);
        const data = await response.json();
        
        if (data.countryCode) {
          countryCode = data.countryCode;
          detectionMethod = 'browser_geolocation';
          console.log('✅ Browser geolocation detected country:', countryCode);
        }
      } catch (err) {
        console.warn('📍 Browser geolocation failed:', err);
      }
    }
    
    // Method 3: Try IP-based geolocation services - with timeout
    if (!countryCode) {
      console.log('🌐 Trying IP-based detection...');
      
      // Try ipapi.co first with timeout
      try {
        const ipapiPromise = fetch('https://ipapi.co/json/');
        const ipapiTimeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('IPapi timeout')), 2000)
        );
        
        const response = await Promise.race([ipapiPromise, ipapiTimeoutPromise]);
        const data = await response.json();
        if (data.country_code && data.country_code !== 'undefined') {
          countryCode = data.country_code;
          detectionMethod = 'ipapi';
          console.log('✅ IPapi detected country:', countryCode);
        }
      } catch (err) {
        console.warn('🌐 ipapi.co failed:', err);
      }
    }
    
    // Method 4: Fallback to simple IP service - with timeout
    if (!countryCode) {
      try {
        const countryIsPromise = fetch('https://api.country.is/');
        const countryIsTimeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Country.is timeout')), 2000)
        );
        
        const response = await Promise.race([countryIsPromise, countryIsTimeoutPromise]);
        const data = await response.json();
        if (data.country) {
          countryCode = data.country;
          detectionMethod = 'country_is';
          console.log('✅ Country.is detected country:', countryCode);
        }
      } catch (err) {
        console.warn('🌐 country.is failed:', err);
      }
    }
    
    // Method 5: Fallback to browser timezone
    if (!countryCode) {
      console.log('🕒 Using timezone fallback...');
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      // Enhanced timezone to country mapping
      const timezoneToCountry = {
        // UK and Ireland
        'Europe/London': 'GB',
        'Europe/Dublin': 'IE',
        
        // US and Canada
        'America/New_York': 'US',
        'America/Los_Angeles': 'US',
        'America/Chicago': 'US',
        'America/Denver': 'US',
        'America/Phoenix': 'US',
        'America/Anchorage': 'US',
        'America/Toronto': 'CA',
        'America/Vancouver': 'CA',
        'America/Montreal': 'CA',
        
        // Europe
        'Europe/Paris': 'FR',
        'Europe/Berlin': 'DE',
        'Europe/Rome': 'IT',
        'Europe/Madrid': 'ES',
        'Europe/Amsterdam': 'NL',
        'Europe/Brussels': 'BE',
        'Europe/Vienna': 'AT',
        'Europe/Zurich': 'CH',
        'Europe/Lisbon': 'PT',
        'Europe/Helsinki': 'FI',
        'Europe/Copenhagen': 'DK',
        'Europe/Stockholm': 'SE',
        'Europe/Oslo': 'NO',
        'Europe/Luxembourg': 'LU',
        
        // Australia and New Zealand
        'Australia/Sydney': 'AU',
        'Australia/Melbourne': 'AU',
        'Australia/Perth': 'AU',
        'Australia/Brisbane': 'AU',
        'Pacific/Auckland': 'NZ',
        
        // Asia
        'Asia/Singapore': 'SG',
        'Asia/Hong_Kong': 'HK',
        'Asia/Tokyo': 'JP',
        'Asia/Shanghai': 'CN',
        'Asia/Kolkata': 'IN',
        'Asia/Dubai': 'AE',
        'Asia/Riyadh': 'SA',
        'Asia/Bangkok': 'TH',
        'Asia/Jakarta': 'ID',
        'Asia/Manila': 'PH',
        'Asia/Kuala_Lumpur': 'MY',
        
        // Africa
        'Africa/Lagos': 'NG',
        'Africa/Accra': 'GH',
        'Africa/Johannesburg': 'ZA',
        'Africa/Nairobi': 'KE',
        'Africa/Cairo': 'EG',
        'Africa/Casablanca': 'MA',
        
        // Americas
        'America/Sao_Paulo': 'BR',
        'America/Mexico_City': 'MX',
        'America/Argentina/Buenos_Aires': 'AR',
        'America/Santiago': 'CL',
        'America/Bogota': 'CO',
        'America/Lima': 'PE'
      };
      
      countryCode = timezoneToCountry[timezone] || 'GB';
      detectionMethod = 'timezone';
      console.log('✅ Timezone detected country:', countryCode, 'from timezone:', timezone);
    }
    
    const finalCountry = countryCode || 'GB';
    console.log(`🎯 Final country detection: ${finalCountry} (method: ${detectionMethod})`);
    
    // Store detection info for debugging
    window.locationDetection = {
      country: finalCountry,
      method: detectionMethod,
      timestamp: new Date().toISOString()
    };
    
    return finalCountry;
  } catch (error) {
    console.error('❌ All country detection methods failed:', error);
    return 'GB'; // Default to UK
  }
};

// Helper function to get current position
const getCurrentPosition = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser'));
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      resolve,
      reject,
      {
        enableHighAccuracy: false, // Use false for faster response
        timeout: 15000, // 15 seconds - more reasonable timeout
        maximumAge: 300000 // 5 minutes cache
      }
    );
  });
};

export const getPaymentProvider = (countryCode) => {
  console.log('🔍 Determining payment provider for country:', countryCode);
  
  // African countries that support Paystack
  const paystackCountries = [
    'NG', // Nigeria
    'GH', // Ghana  
    'ZA', // South Africa
    'KE', // Kenya
    'EG', // Egypt
    'CI', // Côte d'Ivoire
  ];

  // Countries with FULL Stripe Connect support (can create Connect accounts)
  const stripeConnectCountries = [
    'GB', // United Kingdom
    'IE', // Ireland
    'FR', // France
    'DE', // Germany
    'NL', // Netherlands
    'BE', // Belgium
    'AT', // Austria
    'CH', // Switzerland
    'IT', // Italy
    'ES', // Spain
    'PT', // Portugal
    'FI', // Finland
    'DK', // Denmark
    'SE', // Sweden
    'NO', // Norway
    'LU', // Luxembourg
    'US', // United States
    'CA', // Canada
    'AU', // Australia
    'NZ', // New Zealand
    'SG', // Singapore
    'HK', // Hong Kong
    'JP', // Japan
  ];

  // Countries where Stripe payments work but Connect accounts cannot be created
  const stripePaymentsOnlyCountries = [
    'AE', // UAE
    'SA', // Saudi Arabia
    'IL', // Israel
    'MY', // Malaysia
    'TH', // Thailand
  ];

  // Major countries with NO Stripe support at all
  const noStripeCountries = [
    'CN', // China
    'IN', // India  
    'PK', // Pakistan
    'BD', // Bangladesh
    'ID', // Indonesia
    'VN', // Vietnam
    'PH', // Philippines
    'RU', // Russia
    'UA', // Ukraine
    'TR', // Turkey
    'BR', // Brazil
    'MX', // Mexico
    'AR', // Argentina
    'CL', // Chile
    'CO', // Colombia
    'PE', // Peru
    'VE', // Venezuela
    'CR', // Costa Rica
    'GT', // Guatemala
    'HN', // Honduras
    'NI', // Nicaragua
    'PA', // Panama
    'SV', // El Salvador
    'DO', // Dominican Republic
    'JM', // Jamaica
    'TT', // Trinidad and Tobago
    'BB', // Barbados
    'BS', // Bahamas
    'BZ', // Belize
    'GY', // Guyana
    'SR', // Suriname
    'UY', // Uruguay
    'PY', // Paraguay
    'BO', // Bolivia
    'EC', // Ecuador
  ];

  if (paystackCountries.includes(countryCode)) {
    console.log('✅ Paystack country detected');
    return {
      provider: 'paystack',
      name: 'Paystack',
      description: 'Perfect for African markets',
      supported: true,
      hasConnectAccounts: true,
      canReceivePayments: true,
      countryCode,
      region: 'Africa'
    };
  } else if (stripeConnectCountries.includes(countryCode)) {
    console.log('✅ Full Stripe Connect country detected');
    return {
      provider: 'stripe',
      name: 'Stripe Connect',
      description: 'Full payment processing available',
      supported: true,
      hasConnectAccounts: true,
      canReceivePayments: true,
      countryCode,
      region: getRegionForCountry(countryCode)
    };
  } else if (stripePaymentsOnlyCountries.includes(countryCode)) {
    console.log('⚠️ Stripe payments only country detected');
    return {
      provider: 'stripe_limited',
      name: 'Stripe (Limited)',
      description: 'Payments work, but no seller accounts available',
      supported: false,
      hasConnectAccounts: false,
      canReceivePayments: true,
      countryCode,
      region: getRegionForCountry(countryCode),
      fallbackMessage: `In ${getCountryName(countryCode)}, customers can pay with Stripe, but we can't create seller accounts automatically. We'll handle your payouts manually until we add better support for your region.`
    };
  } else if (noStripeCountries.includes(countryCode)) {
    console.log('❌ No Stripe support country detected');
    return {
      provider: 'none',
      name: 'Manual Payments Only',
      description: 'No automatic payment processing available',
      supported: false,
      hasConnectAccounts: false,
      canReceivePayments: false,
      countryCode,
      region: getRegionForCountry(countryCode),
      fallbackMessage: `Unfortunately, we don't have automatic payment processing available in ${getCountryName(countryCode)} yet. But you can still create your shop! We'll handle all payments and payouts manually. Contact our support team to get started.`
    };
  } else {
    console.log('❓ Unknown country, defaulting to limited Stripe');
    return {
      provider: 'stripe_unknown',
      name: 'Stripe (Unknown Support)', 
      description: 'Payment support unclear for your country',
      supported: false,
      hasConnectAccounts: false,
      canReceivePayments: true,
      countryCode,
      region: 'Unknown',
      fallbackMessage: `We're not sure about payment support in ${getCountryName(countryCode)}. You can try setting up payments, but you may need manual assistance. Contact our support team for help.`
    };
  }
};

// Helper function to determine region
const getRegionForCountry = (countryCode) => {
  const regions = {
    // Europe
    'GB': 'Europe', 'IE': 'Europe', 'FR': 'Europe', 'DE': 'Europe', 'NL': 'Europe',
    'BE': 'Europe', 'AT': 'Europe', 'CH': 'Europe', 'IT': 'Europe', 'ES': 'Europe',
    'PT': 'Europe', 'FI': 'Europe', 'DK': 'Europe', 'SE': 'Europe', 'NO': 'Europe',
    'LU': 'Europe',
    
    // North America
    'US': 'North America', 'CA': 'North America',
    
    // Asia Pacific
    'AU': 'Asia Pacific', 'NZ': 'Asia Pacific', 'SG': 'Asia Pacific', 'HK': 'Asia Pacific',
    'JP': 'Asia Pacific', 'MY': 'Asia Pacific', 'TH': 'Asia Pacific',
    
    // Middle East
    'AE': 'Middle East', 'SA': 'Middle East', 'IL': 'Middle East',
    
    // Asia
    'CN': 'Asia', 'IN': 'Asia', 'PK': 'Asia', 'BD': 'Asia', 'ID': 'Asia',
    'VN': 'Asia', 'PH': 'Asia',
    
    // Americas
    'BR': 'South America', 'MX': 'North America', 'AR': 'South America',
    'CL': 'South America', 'CO': 'South America', 'PE': 'South America'
  };
  
  return regions[countryCode] || 'Other';
};

export const getCountryName = (countryCode) => {
  const countries = {
    // Stripe Supported Countries
    'GB': 'United Kingdom',
    'US': 'United States',
    'CA': 'Canada',
    'AU': 'Australia',
    'NZ': 'New Zealand',
    'SG': 'Singapore',
    'HK': 'Hong Kong',
    'JP': 'Japan',
    'IE': 'Ireland',
    'FR': 'France',
    'DE': 'Germany',
    'NL': 'Netherlands',
    'BE': 'Belgium',
    'AT': 'Austria',
    'CH': 'Switzerland',
    'IT': 'Italy',
    'ES': 'Spain',
    'PT': 'Portugal',
    'FI': 'Finland',
    'DK': 'Denmark',
    'SE': 'Sweden',
    'NO': 'Norway',
    'LU': 'Luxembourg',
    
    // Paystack Supported Countries
    'NG': 'Nigeria',
    'GH': 'Ghana',
    'ZA': 'South Africa',
    'KE': 'Kenya',
    'EG': 'Egypt',
    'CI': 'Côte d\'Ivoire',
    
    // Major Unsupported Countries
    'CN': 'China',
    'IN': 'India',
    'PK': 'Pakistan',
    'BD': 'Bangladesh',
    'ID': 'Indonesia',
    'MY': 'Malaysia',
    'TH': 'Thailand',
    'VN': 'Vietnam',
    'PH': 'Philippines',
    'RU': 'Russia',
    'UA': 'Ukraine',
    'TR': 'Turkey',
    'SA': 'Saudi Arabia',
    'AE': 'United Arab Emirates',
    'IL': 'Israel',
    'BR': 'Brazil',
    'MX': 'Mexico',
    'AR': 'Argentina',
    'CL': 'Chile',
    'CO': 'Colombia',
    'PE': 'Peru',
    'VE': 'Venezuela',
    'CR': 'Costa Rica',
    'GT': 'Guatemala',
    'HN': 'Honduras',
    'NI': 'Nicaragua',
    'PA': 'Panama',
    'SV': 'El Salvador',
    'DO': 'Dominican Republic',
    'JM': 'Jamaica',
    'TT': 'Trinidad and Tobago',
    'BB': 'Barbados',
    'BS': 'Bahamas',
    'BZ': 'Belize',
    'GY': 'Guyana',
    'SR': 'Suriname',
    'UY': 'Uruguay',
    'PY': 'Paraguay',
    'BO': 'Bolivia',
    'EC': 'Ecuador',
  };
  
  return countries[countryCode] || `${countryCode} (Unknown Country)`;
};