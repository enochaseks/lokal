import React from 'react';
import Navbar from '../components/Navbar';

function AboutPage() {
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