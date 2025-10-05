import React from 'react';

const SEOStoreCard = ({ store }) => {
  // Generate structured data for each store
  const storeStructuredData = {
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

  return (
    <div className="seo-store-card">
      {/* Structured Data */}
      <script 
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(storeStructuredData) }}
      />
      
      {/* Store Card Content */}
      <div className="store-card">
        <div className="store-header">
          <h3 className="store-name">{store.name}</h3>
          <div className="store-category">{store.category}</div>
        </div>
        
        <div className="store-details">
          <div className="store-address">
            <span className="icon">📍</span>
            {store.address}, {store.city}, {store.postcode}
          </div>
          
          {store.phone && (
            <div className="store-phone">
              <span className="icon">📞</span>
              <a href={`tel:${store.phone}`}>{store.phone}</a>
            </div>
          )}
          
          {store.website && (
            <div className="store-website">
              <span className="icon">🌐</span>
              <a href={store.website} target="_blank" rel="noopener noreferrer">
                Visit Website
              </a>
            </div>
          )}
          
          <div className="store-description">
            <p>{store.description}</p>
          </div>
          
          {store.specialties && (
            <div className="store-specialties">
              <strong>Specialties:</strong>
              <div className="specialty-tags">
                {store.specialties.map((specialty, index) => (
                  <span key={index} className="specialty-tag">
                    {specialty}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {store.rating && (
            <div className="store-rating">
              <span className="stars">
                {'★'.repeat(Math.floor(store.rating))}
                {'☆'.repeat(5 - Math.floor(store.rating))}
              </span>
              <span className="rating-text">
                {store.rating} ({store.reviewCount} reviews)
              </span>
            </div>
          )}
          
          <div className="store-actions">
            <button className="btn-primary">
              View Details
            </button>
            <button className="btn-secondary">
              Get Directions
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SEOStoreCard;