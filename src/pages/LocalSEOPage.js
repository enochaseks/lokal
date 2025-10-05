import React from 'react';

const LocalSEOPage = ({ city, stores = [] }) => {
  const pageTitle = `African & Caribbean Stores in ${city} | Lokal Shops`;
  const pageDescription = `Find authentic African and Caribbean stores, restaurants, and services in ${city}. Discover local businesses, ethnic food stores, and community services near you.`;

  // Structured data for the city page
  const cityPageStructuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": pageTitle,
    "description": pageDescription,
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

  React.useEffect(() => {
    // Update document title and meta description
    document.title = pageTitle;
    
    // Update meta description
    let metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', pageDescription);
    }

    // Update canonical URL
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (canonicalLink) {
      canonicalLink.setAttribute('href', `https://lokalshops.co.uk/${city.toLowerCase()}`);
    }

    // Update Open Graph tags
    let ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.setAttribute('content', pageTitle);
    }

    let ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogDescription) {
      ogDescription.setAttribute('content', pageDescription);
    }

    let ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) {
      ogUrl.setAttribute('content', `https://lokalshops.co.uk/${city.toLowerCase()}`);
    }
  }, [city, pageTitle, pageDescription]);

  return (
    <div className="local-seo-page">
      {/* Structured Data */}
      <script 
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(cityPageStructuredData) }}
      />

      {/* Hero Section */}
      <section className="hero-section">
        <div className="container">
          <h1>African & Caribbean Stores in {city}</h1>
          <p className="hero-description">
            Discover authentic African and Caribbean businesses in {city}. 
            From traditional restaurants to specialty grocery stores, 
            find everything you need to connect with your community.
          </p>
          
          <div className="search-bar">
            <input 
              type="text" 
              placeholder={`Search stores in ${city}...`}
              className="search-input"
            />
            <button className="search-button">Search</button>
          </div>
        </div>
      </section>

      {/* Statistics Section */}
      <section className="stats-section">
        <div className="container">
          <div className="stats-grid">
            <div className="stat-item">
              <h3>{stores.length}</h3>
              <p>Local Businesses</p>
            </div>
            <div className="stat-item">
              <h3>{stores.filter(s => s.category === 'Restaurant').length}</h3>
              <p>Restaurants</p>
            </div>
            <div className="stat-item">
              <h3>{stores.filter(s => s.category === 'Grocery').length}</h3>
              <p>Grocery Stores</p>
            </div>
            <div className="stat-item">
              <h3>{stores.filter(s => s.category === 'Beauty').length}</h3>
              <p>Beauty Services</p>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="categories-section">
        <div className="container">
          <h2>Popular Categories in {city}</h2>
          <div className="categories-grid">
            <div className="category-card">
              <h3>🍽️ African Restaurants</h3>
              <p>Authentic flavors from across Africa</p>
              <a href={`/${city.toLowerCase()}/african-restaurants`}>
                View All ({stores.filter(s => s.cuisine === 'African').length})
              </a>
            </div>
            
            <div className="category-card">
              <h3>🌴 Caribbean Restaurants</h3>
              <p>Island cuisine and Caribbean specialties</p>
              <a href={`/${city.toLowerCase()}/caribbean-restaurants`}>
                View All ({stores.filter(s => s.cuisine === 'Caribbean').length})
              </a>
            </div>
            
            <div className="category-card">
              <h3>🛒 Ethnic Grocery Stores</h3>
              <p>Specialty ingredients and traditional foods</p>
              <a href={`/${city.toLowerCase()}/grocery-stores`}>
                View All ({stores.filter(s => s.category === 'Grocery').length})
              </a>
            </div>
            
            <div className="category-card">
              <h3>💄 Beauty & Hair Salons</h3>
              <p>Specialized beauty services</p>
              <a href={`/${city.toLowerCase()}/beauty-salons`}>
                View All ({stores.filter(s => s.category === 'Beauty').length})
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Stores Section */}
      {stores.length > 0 && (
        <section className="featured-stores-section">
          <div className="container">
            <h2>Featured Businesses in {city}</h2>
            <div className="stores-grid">
              {stores.slice(0, 6).map(store => (
                <div key={store.id} className="store-preview-card">
                  <h3>{store.name}</h3>
                  <p className="store-category">{store.category} • {store.cuisine}</p>
                  <p className="store-address">{store.address}</p>
                  <div className="store-rating">
                    <span className="stars">
                      {'★'.repeat(Math.floor(store.rating || 4))}
                    </span>
                    <span>({store.reviewCount || '5+'} reviews)</span>
                  </div>
                  <a href={`/store/${store.id}`} className="view-store-btn">
                    View Details
                  </a>
                </div>
              ))}
            </div>
            
            <div className="view-all-stores">
              <a href={`/${city.toLowerCase()}/all-stores`} className="btn-primary">
                View All {stores.length} Stores in {city}
              </a>
            </div>
          </div>
        </section>
      )}

      {/* Local Information Section */}
      <section className="local-info-section">
        <div className="container">
          <h2>About African & Caribbean Community in {city}</h2>
          <div className="info-content">
            <p>
              {city} is home to a vibrant African and Caribbean community with 
              rich cultural heritage and diverse businesses. Our local directory 
              helps you discover authentic restaurants, specialty stores, and 
              community services that celebrate this heritage.
            </p>
            
            <h3>What You'll Find in {city}:</h3>
            <ul>
              <li>Traditional African and Caribbean restaurants</li>
              <li>Specialty grocery stores with authentic ingredients</li>
              <li>Beauty salons specializing in African and Caribbean hair care</li>
              <li>Cultural centers and community organizations</li>
              <li>Clothing stores with traditional and modern African/Caribbean fashion</li>
            </ul>
            
            <h3>Support Local Businesses</h3>
            <p>
              By choosing local African and Caribbean businesses, you're not just 
              getting authentic products and services – you're supporting entrepreneurs 
              who contribute to the cultural richness and economic vitality of {city}.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="faq-section">
        <div className="container">
          <h2>Frequently Asked Questions</h2>
          <div className="faq-list">
            <div className="faq-item">
              <h3>How do I find African stores near me in {city}?</h3>
              <p>Use our search feature above or browse by category to find African and Caribbean stores in your area of {city}.</p>
            </div>
            
            <div className="faq-item">
              <h3>Are these businesses verified?</h3>
              <p>Yes, all businesses listed on Lokal Shops are verified local establishments in {city}.</p>
            </div>
            
            <div className="faq-item">
              <h3>How can I add my business to the directory?</h3>
              <p>Business owners can register their store for free by clicking the "Register Your Store" link.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LocalSEOPage;