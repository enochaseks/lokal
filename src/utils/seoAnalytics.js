// Google Analytics and SEO utilities for Lokal Shops
class SEOAnalytics {
  constructor() {
    this.isGA4Loaded = false;
    this.init();
  }

  init() {
    // Check if Google Analytics is loaded
    if (typeof gtag !== 'undefined') {
      this.isGA4Loaded = true;
    }
  }

  // Track page views
  trackPageView(pagePath, pageTitle) {
    if (this.isGA4Loaded) {
      gtag('config', 'G-QZ4BEB9JGQ', {
        page_path: pagePath,
        page_title: pageTitle
      });
    }

    // Also track custom events
    this.trackEvent('page_view', {
      page_path: pagePath,
      page_title: pageTitle
    });
  }

  // Track custom events
  trackEvent(eventName, parameters = {}) {
    if (this.isGA4Loaded) {
      gtag('event', eventName, parameters);
    }

    // Console log for development
    console.log('SEO Event:', eventName, parameters);
  }

  // Track store interactions
  trackStoreView(storeId, storeName, category) {
    this.trackEvent('view_store', {
      store_id: storeId,
      store_name: storeName,
      store_category: category
    });
  }

  trackStoreSearch(searchTerm, resultsCount, location) {
    this.trackEvent('search_stores', {
      search_term: searchTerm,
      results_count: resultsCount,
      search_location: location
    });
  }

  trackStoreContact(storeId, contactMethod) {
    this.trackEvent('contact_store', {
      store_id: storeId,
      contact_method: contactMethod // 'phone', 'website', 'directions'
    });
  }

  // Track user engagement
  trackNewsletterSignup(source) {
    this.trackEvent('newsletter_signup', {
      source: source
    });
  }

  trackBlogPostRead(postSlug, postTitle, category) {
    this.trackEvent('read_blog_post', {
      post_slug: postSlug,
      post_title: postTitle,
      post_category: category
    });
  }

  // Local SEO tracking
  trackLocationSearch(city, category) {
    this.trackEvent('location_search', {
      city: city,
      category: category
    });
  }

  // Dynamic SEO updates
  updatePageSEO(seoData) {
    const { title, description, canonical, ogTitle, ogDescription, ogUrl, keywords } = seoData;

    // Update document title
    if (title) {
      document.title = title;
    }

    // Update meta description
    if (description) {
      this.updateMetaTag('name', 'description', description);
    }

    // Update keywords
    if (keywords) {
      this.updateMetaTag('name', 'keywords', keywords);
    }

    // Update canonical URL
    if (canonical) {
      this.updateLinkTag('canonical', canonical);
    }

    // Update Open Graph tags
    if (ogTitle) {
      this.updateMetaTag('property', 'og:title', ogTitle);
    }

    if (ogDescription) {
      this.updateMetaTag('property', 'og:description', ogDescription);
    }

    if (ogUrl) {
      this.updateMetaTag('property', 'og:url', ogUrl);
    }

    // Track the page view
    this.trackPageView(window.location.pathname, title);
  }

  updateMetaTag(attribute, name, content) {
    let tag = document.querySelector(`meta[${attribute}="${name}"]`);
    if (tag) {
      tag.setAttribute('content', content);
    } else {
      // Create new meta tag if it doesn't exist
      tag = document.createElement('meta');
      tag.setAttribute(attribute, name);
      tag.setAttribute('content', content);
      document.head.appendChild(tag);
    }
  }

  updateLinkTag(rel, href) {
    let tag = document.querySelector(`link[rel="${rel}"]`);
    if (tag) {
      tag.setAttribute('href', href);
    } else {
      // Create new link tag if it doesn't exist
      tag = document.createElement('link');
      tag.setAttribute('rel', rel);
      tag.setAttribute('href', href);
      document.head.appendChild(tag);
    }
  }

  // Generate structured data
  generateStoreStructuredData(store) {
    return {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "name": store.name,
      "description": store.description,
      "url": `https://lokalshops.co.uk/store/${store.id}`,
      "telephone": store.phone,
      "address": {
        "@type": "PostalAddress",
        "streetAddress": store.address,
        "addressLocality": store.city,
        "addressRegion": store.region,
        "postalCode": store.postcode,
        "addressCountry": "GB"
      },
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": store.latitude,
        "longitude": store.longitude
      },
      "openingHours": store.openingHours,
      "servesCuisine": store.cuisine,
      "priceRange": store.priceRange,
      "image": store.images?.[0],
      "aggregateRating": store.rating ? {
        "@type": "AggregateRating",
        "ratingValue": store.rating,
        "reviewCount": store.reviewCount
      } : undefined
    };
  }

  // Submit structured data to page
  addStructuredData(data, id = null) {
    const scriptId = id || `structured-data-${Date.now()}`;
    
    // Remove existing script if updating
    const existingScript = document.getElementById(scriptId);
    if (existingScript) {
      existingScript.remove();
    }

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = scriptId;
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);
  }

  // Generate breadcrumb structured data
  generateBreadcrumbData(breadcrumbs) {
    return {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": breadcrumbs.map((crumb, index) => ({
        "@type": "ListItem",
        "position": index + 1,
        "name": crumb.name,
        "item": crumb.url
      }))
    };
  }

  // Local SEO city page data
  generateCityPageData(city, stores) {
    return {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": `African & Caribbean Stores in ${city}`,
      "description": `Find authentic African and Caribbean stores in ${city}`,
      "url": `https://lokalshops.co.uk/${city.toLowerCase()}`,
      "about": {
        "@type": "Place",
        "name": city,
        "address": {
          "@type": "PostalAddress",
          "addressLocality": city,
          "addressCountry": "GB"
        }
      },
      "mainEntity": {
        "@type": "ItemList",
        "numberOfItems": stores.length,
        "itemListElement": stores.map((store, index) => ({
          "@type": "LocalBusiness",
          "position": index + 1,
          "name": store.name,
          "url": `https://lokalshops.co.uk/store/${store.id}`
        }))
      }
    };
  }
}

// Initialize SEO Analytics
const seoAnalytics = new SEOAnalytics();

// Export for use in React components
export default seoAnalytics;