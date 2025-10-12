import React, { useEffect } from 'react';
import Navbar from '../components/Navbar';

function AboutPage() {
  // SEO optimization for about page
  useEffect(() => {
    document.title = "About Lokal - Find African & Caribbean Stores Near You | Lokal Shops";
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 
        'Learn about Lokal - Find African & Caribbean Stores Near You. Connecting communities with authentic local stores, restaurants, and services across the UK.'
      );
    }

    const canonicalLink = document.querySelector('link[rel="canonical"]');
    if (canonicalLink) {
      canonicalLink.setAttribute('href', 'https://lokalshops.co.uk/about');
    }

    // Update keywords for about page
    let metaKeywords = document.querySelector('meta[name="keywords"]');
    if (metaKeywords) {
      metaKeywords.setAttribute('content', 
        'about lokal shops, african caribbean stores, company history, mission, community marketplace, local business support'
      );
    }

    // Add structured data for about page
    const structuredData = {
      "@context": "https://schema.org",
      "@type": "AboutPage",
      "name": "About Lokal Shops",
      "description": "Learn about Lokal - Find African & Caribbean Stores Near You",
      "url": "https://lokalshops.co.uk/about",
      "mainEntity": {
        "@type": "Organization",
        "name": "Lokal Shops",
        "url": "https://lokalshops.co.uk",
        "description": "Find African & Caribbean Stores Near You - connecting communities with local stores",
        "foundingDate": "2023",
        "mission": "Empower African & Caribbean businesses to reach new customers and grow their income in a community-driven way"
      }
    };

    // Remove existing structured data
    const existingScript = document.querySelector('script[type="application/ld+json"]');
    if (existingScript) {
      existingScript.remove();
    }

    // Add new structured data
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(structuredData);
    document.head.appendChild(script);
  }, []);

  return (
    <div style={{ background: '#F0F2F5', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: 700, margin: '2rem auto', background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px #B8B8B8', padding: '2.5rem 2rem' }}>
        <h2 style={{ fontWeight: 700, fontSize: '1.5rem', marginBottom: 18 }}>About Lokal</h2>
        <div style={{ color: '#222', fontSize: '1.1rem', lineHeight: 1.7 }}>
          <p><b>Lokal</b> is your dedicated African & Caribbean e-commerce marketplace, designed to help you discover and connect with nearby stores in your community. Unlike generic search engines that provide vague locations and limited information, Lokal empowers you to create a vibrant virtual store, showcase your products, engage with customers, and receive real feedback—all in one place.</p>
          <p>The inspiration for Lokal began in 2023, when our founder recognized a significant gap in the market. Finding authentic African and Caribbean stores for daily shopping was a challenge, and even when such stores were found, accessibility was often an issue. Lokal—originally known as Folo—was created to bridge this gap, making it easy to find, shop, and communicate with local African and Caribbean businesses. Whether you want to shop online, chat with store owners, or arrange delivery or collection, Lokal brings the marketplace to your fingertips.</p>
          <p>Our mission is to empower African & Caribbean businesses to reach new customers and grow their income in a way that is more accessible and community-driven than traditional platforms like Google, Facebook, or Instagram. We are building a space where business owners can not only sell to local shoppers, but also connect with vendors and partners from across Africa, the Caribbean, and around the world.</p>
          <p>At Lokal, we believe African & Caribbean businesses matter. We are committed to building a supportive community that helps everyone thrive—whether you are a store owner, a shopper, or a vendor. Join us as we celebrate culture, support local enterprise, and create new opportunities for growth and connection.</p>
        </div>
      </div>
    </div>
  );
}

export default AboutPage; 