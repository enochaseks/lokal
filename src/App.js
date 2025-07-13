import logo from './logo.svg';
import './App.css';
import ExplorePage from './pages/ExplorePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import { BrowserRouter as Router, Routes, Route } from 'react-router';
import OnboardingPage from './pages/OnboardingPage';
import OnboardingSellCategoryPage from './pages/OnboardingSellCategoryPage';
import OnboardingSellLocationPage from './pages/OnboardingSellLocationPage';
import CreateShopPage from './pages/CreateShopPage';
import StoreProfilePage from './pages/StoreProfilePage';
import StorePreviewPage from './pages/StorePreviewPage';
import StoreReviewsPage from './pages/StoreReviewsPage';
import FeedPage from './pages/FeedPage';
import SettingsPage from './pages/SettingsPage';
import AboutPage from './pages/AboutPage';
import OnboardingShopTypePage from './pages/OnboardingShopTypePage';
import CreateProfilePage from './pages/CreateProfilePage';
import ProfilePage from './pages/ProfilePage';
import StoreReviewPreviewPage from './pages/StoreReviewPreviewPage';
import MessagesPage from './pages/MessagesPage';
import { CartProvider } from './CartContext';
import ShopCartPage from './pages/ShopCartPage';
import { useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useLocation, useNavigate } from 'react-router-dom';

function OnboardingGuard({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const checkOnboarding = async () => {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) return;
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const onboardingStep = userDoc.data().onboardingStep;
        if (onboardingStep && onboardingStep !== 'complete' && !location.pathname.includes(onboardingStep)) {
          navigate('/' + onboardingStep, { replace: true });
        }
      }
    };
    checkOnboarding();
  }, [location, navigate]);
  return children;
}

function App() {
  return (
    <CartProvider>
      <Router>
        <OnboardingGuard>
          <div className="App" style={{ minHeight: '100vh', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#F9F5EE' }}>
            <div
              style={{
                width: '100%',
                maxWidth: '1200px',
                minHeight: '100vh',
                background: 'inherit',
                boxShadow: '0 0 0 #fff',
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                padding: '0 16px',
              }}
            >
              <Routes>
                <Route path="/" element={<ExplorePage />} />
                <Route path="/explore" element={<ExplorePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/onboarding" element={<OnboardingPage />} />
                <Route path="/onboarding-sell-category" element={<OnboardingSellCategoryPage />} />
                <Route path="/onboarding-sell-location" element={<OnboardingSellLocationPage />} />
                <Route path="/create-shop" element={<CreateShopPage />} />
                <Route path="/store-profile" element={<StoreProfilePage />} />
                <Route path="/store-preview/:id" element={<StorePreviewPage />} />
                <Route path="/my-reviews" element={<StoreReviewsPage />} />
                <Route path="/feed" element={<FeedPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/onboarding-shop-type" element={<OnboardingShopTypePage />} />
                <Route path="/create-profile" element={<CreateProfilePage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/store-review-preview/:storeId" element={<StoreReviewPreviewPage />} />
                <Route path="/messages" element={<MessagesPage />} />
                <Route path="/shop-cart" element={<ShopCartPage />} />
              </Routes>
            </div>
            <style>{`
              @media (max-width: 600px) {
                .App > div {
                  max-width: 100vw !important;
                  padding: 0 4px !important;
                }
              }
            `}</style>
          </div>
        </OnboardingGuard>
      </Router>
    </CartProvider>
  );
}

export default App;
