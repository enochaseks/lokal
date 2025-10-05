import React from 'react';

const BlogPage = () => {
  const blogPosts = [
    {
      id: 1,
      title: "Best African Restaurants in London: A Complete Guide",
      slug: "best-african-restaurants-london",
      excerpt: "Discover authentic African cuisine in London's vibrant restaurant scene. From Ethiopian injera to Nigerian jollof rice, explore the flavors of Africa.",
      author: "Lokal Team",
      date: "2025-10-05",
      readTime: "8 min read",
      category: "Food Guide",
      image: "/images/blog/african-restaurants-london.jpg",
      tags: ["African Food", "London", "Restaurants", "Guide"]
    },
    {
      id: 2,
      title: "Caribbean Food Culture in the UK: History and Heritage",
      slug: "caribbean-food-culture-uk",
      excerpt: "Explore the rich history of Caribbean cuisine in the UK and how it has shaped British food culture over decades.",
      author: "Cultural Editor",
      date: "2025-10-03",
      readTime: "6 min read",
      category: "Culture",
      image: "/images/blog/caribbean-culture-uk.jpg",
      tags: ["Caribbean", "Culture", "History", "Food"]
    },
    {
      id: 3,
      title: "Starting Your African or Caribbean Business in the UK",
      slug: "starting-business-uk-guide",
      excerpt: "Complete guide for entrepreneurs looking to start an African or Caribbean business in the UK. From licensing to marketing tips.",
      author: "Business Expert",
      date: "2025-10-01",
      readTime: "12 min read",
      category: "Business",
      image: "/images/blog/starting-business-uk.jpg",
      tags: ["Business", "Entrepreneurship", "UK", "Guide"]
    },
    {
      id: 4,
      title: "Essential Ingredients: Building Your African Pantry",
      slug: "african-pantry-essentials",
      excerpt: "Stock your kitchen with essential African ingredients. Learn about key spices, grains, and products available in UK stores.",
      author: "Chef Amara",
      date: "2025-09-28",
      readTime: "5 min read",
      category: "Cooking",
      image: "/images/blog/african-pantry.jpg",
      tags: ["Cooking", "Ingredients", "African Food", "Shopping"]
    },
    {
      id: 5,
      title: "Directory of African Hair Salons in Major UK Cities",
      slug: "african-hair-salons-uk",
      excerpt: "Find professional African hair care services across the UK. Specialized salons for natural hair, braids, and traditional styles.",
      author: "Beauty Editor",
      date: "2025-09-25",
      readTime: "7 min read",
      category: "Beauty",
      image: "/images/blog/african-hair-salons.jpg",
      tags: ["Beauty", "Hair Care", "African", "Salons"]
    }
  ];

  React.useEffect(() => {
    // Update SEO for blog page
    document.title = "Local Business Blog - African & Caribbean Community | Lokal Shops";
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 
        'Read the latest guides, stories, and insights about African and Caribbean businesses, culture, and community in the UK.'
      );
    }

    const canonicalLink = document.querySelector('link[rel="canonical"]');
    if (canonicalLink) {
      canonicalLink.setAttribute('href', 'https://lokalshops.co.uk/blog');
    }
  }, []);

  const blogStructuredData = {
    "@context": "https://schema.org",
    "@type": "Blog",
    "name": "Lokal Shops Blog",
    "description": "Insights about African and Caribbean businesses and culture in the UK",
    "url": "https://lokalshops.co.uk/blog",
    "blogPost": blogPosts.map(post => ({
      "@type": "BlogPosting",
      "headline": post.title,
      "description": post.excerpt,
      "url": `https://lokalshops.co.uk/blog/${post.slug}`,
      "datePublished": post.date,
      "author": {
        "@type": "Person",
        "name": post.author
      },
      "publisher": {
        "@type": "Organization",
        "name": "Lokal Shops",
        "logo": {
          "@type": "ImageObject",
          "url": "https://lokalshops.co.uk/images/logo.png"
        }
      },
      "image": `https://lokalshops.co.uk${post.image}`,
      "keywords": post.tags.join(", ")
    }))
  };

  return (
    <div className="blog-page">
      {/* Structured Data */}
      <script 
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogStructuredData) }}
      />

      {/* Hero Section */}
      <section className="blog-hero">
        <div className="container">
          <h1>Lokal Community Blog</h1>
          <p className="hero-description">
            Stories, guides, and insights about African and Caribbean businesses, 
            culture, and community life in the UK.
          </p>
        </div>
      </section>

      {/* Featured Post */}
      <section className="featured-post">
        <div className="container">
          <div className="featured-card">
            <div className="featured-image">
              <img src={blogPosts[0].image} alt={blogPosts[0].title} />
            </div>
            <div className="featured-content">
              <span className="featured-label">Featured Post</span>
              <h2>{blogPosts[0].title}</h2>
              <p>{blogPosts[0].excerpt}</p>
              <div className="post-meta">
                <span className="author">By {blogPosts[0].author}</span>
                <span className="date">{new Date(blogPosts[0].date).toLocaleDateString()}</span>
                <span className="read-time">{blogPosts[0].readTime}</span>
              </div>
              <a href={`/blog/${blogPosts[0].slug}`} className="read-more-btn">
                Read Full Article
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Filter */}
      <section className="blog-categories">
        <div className="container">
          <h3>Browse by Category</h3>
          <div className="category-filters">
            <button className="category-btn active">All Posts</button>
            <button className="category-btn">Food Guide</button>
            <button className="category-btn">Business</button>
            <button className="category-btn">Culture</button>
            <button className="category-btn">Beauty</button>
            <button className="category-btn">Cooking</button>
          </div>
        </div>
      </section>

      {/* Blog Posts Grid */}
      <section className="blog-posts">
        <div className="container">
          <div className="posts-grid">
            {blogPosts.slice(1).map(post => (
              <article key={post.id} className="post-card">
                <div className="post-image">
                  <img src={post.image} alt={post.title} />
                  <span className="post-category">{post.category}</span>
                </div>
                <div className="post-content">
                  <h3 className="post-title">{post.title}</h3>
                  <p className="post-excerpt">{post.excerpt}</p>
                  <div className="post-meta">
                    <span className="author">By {post.author}</span>
                    <span className="date">{new Date(post.date).toLocaleDateString()}</span>
                    <span className="read-time">{post.readTime}</span>
                  </div>
                  <div className="post-tags">
                    {post.tags.map(tag => (
                      <span key={tag} className="tag">{tag}</span>
                    ))}
                  </div>
                  <a href={`/blog/${post.slug}`} className="read-more">
                    Read More →
                  </a>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter Signup */}
      <section className="newsletter-signup">
        <div className="container">
          <div className="newsletter-card">
            <h3>Stay Updated</h3>
            <p>Get the latest stories about local businesses and community news delivered to your inbox.</p>
            <form className="newsletter-form">
              <input 
                type="email" 
                placeholder="Enter your email address"
                className="newsletter-input"
                required
              />
              <button type="submit" className="newsletter-btn">
                Subscribe
              </button>
            </form>
            <p className="newsletter-privacy">
              We respect your privacy. Unsubscribe at any time.
            </p>
          </div>
        </div>
      </section>

      {/* Popular Topics */}
      <section className="popular-topics">
        <div className="container">
          <h3>Popular Topics</h3>
          <div className="topics-cloud">
            <a href="/blog/tag/african-food" className="topic-tag">African Food</a>
            <a href="/blog/tag/caribbean-cuisine" className="topic-tag">Caribbean Cuisine</a>
            <a href="/blog/tag/london-restaurants" className="topic-tag">London Restaurants</a>
            <a href="/blog/tag/business-tips" className="topic-tag">Business Tips</a>
            <a href="/blog/tag/hair-care" className="topic-tag">Hair Care</a>
            <a href="/blog/tag/community" className="topic-tag">Community</a>
            <a href="/blog/tag/culture" className="topic-tag">Culture</a>
            <a href="/blog/tag/recipes" className="topic-tag">Recipes</a>
          </div>
        </div>
      </section>
    </div>
  );
};

export default BlogPage;