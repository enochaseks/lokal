import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';

function ReportsPage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [complaints, setComplaints] = useState([]);
  const [isSeller, setIsSeller] = useState(false);

  // Currency symbols
  const currencySymbols = {
    GBP: "£", USD: "$", EUR: "€", NGN: "₦", CAD: "C$", AUD: "A$",
    ZAR: "R", GHS: "₵", KES: "KSh", XOF: "CFA", XAF: "CFA",
    INR: "₹", JPY: "¥", CNY: "¥"
  };

  const getCurrencySymbol = (code) => currencySymbols[code] || code;
  const currenciesWithDecimals = ["GBP", "USD", "EUR", "CAD", "AUD", "ZAR", "GHS", "KES", "INR", "CNY"];

  const formatPrice = (price, currency) => {
    if (currenciesWithDecimals.includes(currency)) {
      return Number(price).toFixed(2);
    }
    return price;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown';
    let date;
    if (timestamp.toDate) {
      date = timestamp.toDate();
    } else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else {
      date = new Date(timestamp);
    }
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending_review': return '#F59E0B';
      case 'resolved': return '#10B981';
      case 'serious_complaint': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending_review': return 'Pending Review';
      case 'resolved': return 'Resolved';
      case 'serious_complaint': return 'Serious Complaint';
      default: return status;
    }
  };

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        
        // Check if user is a seller
        try {
          const storeDoc = await getDoc(doc(db, 'stores', user.uid));
          if (storeDoc.exists()) {
            setIsSeller(true);
            
            // Fetch complaints for this seller - both old format (sellerId) and new store reports (reportedStoreOwner)
            const complaintsQuery1 = query(
              collection(db, 'admin_complaints'),
              where('sellerId', '==', user.uid),
              orderBy('timestamp', 'desc')
            );
            
            const complaintsQuery2 = query(
              collection(db, 'admin_complaints'),
              where('reportedStoreOwner', '==', user.uid),
              orderBy('timestamp', 'desc')
            );
            
            // Listen to both queries
            const unsubscribeComplaints1 = onSnapshot(complaintsQuery1, (snapshot) => {
              const complaintsData1 = [];
              snapshot.forEach((doc) => {
                complaintsData1.push({
                  id: doc.id,
                  ...doc.data()
                });
              });
              
              // Now get store reports too
              const unsubscribeComplaints2 = onSnapshot(complaintsQuery2, (snapshot2) => {
                const complaintsData2 = [];
                snapshot2.forEach((doc) => {
                  complaintsData2.push({
                    id: doc.id,
                    ...doc.data()
                  });
                });
                
                // Combine both arrays and remove duplicates (if any)
                const allComplaints = [...complaintsData1, ...complaintsData2];
                const uniqueComplaints = allComplaints.filter((complaint, index, self) => 
                  index === self.findIndex((c) => c.id === complaint.id)
                );
                
                // Sort by timestamp descending
                uniqueComplaints.sort((a, b) => {
                  const timestampA = a.timestamp || a.submittedAt;
                  const timestampB = b.timestamp || b.submittedAt;
                  if (!timestampA || !timestampB) return 0;
                  return timestampB.toMillis() - timestampA.toMillis();
                });
                
                setComplaints(uniqueComplaints);
                setLoading(false);
              });
              
              return () => {
                unsubscribeComplaints1();
                unsubscribeComplaints2();
              };
            });
            
            return () => unsubscribeComplaints1();
          } else {
            // Not a seller, redirect
            navigate('/explore');
          }
        } catch (error) {
          console.error('Error checking seller status:', error);
          navigate('/explore');
        }
      } else {
        navigate('/login');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  if (loading) {
    return (
      <div>
        <Navbar />
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '50vh',
          fontSize: '18px',
          color: '#666'
        }}>
          Loading reports...
        </div>
      </div>
    );
  }

  if (!isSeller) {
    return (
      <div>
        <Navbar />
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '50vh',
          fontSize: '18px',
          color: '#666'
        }}>
          Access denied. This page is for sellers only.
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navbar />
      <div style={{ 
        maxWidth: '1200px', 
        margin: '2rem auto', 
        padding: '0 1rem',
        minHeight: 'calc(100vh - 120px)'
      }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ 
            fontSize: '2rem', 
            fontWeight: 'bold', 
            color: '#1F2937',
            marginBottom: '0.5rem'
          }}>
            📊 Reports & Complaints
          </h1>
          <p style={{ color: '#6B7280', fontSize: '1rem' }}>
            View and track complaints and reports filed against your store
          </p>
        </div>

        {complaints.length === 0 ? (
          <div style={{
            backgroundColor: '#F9FAFB',
            border: '1px solid #E5E7EB',
            borderRadius: '8px',
            padding: '3rem',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1F2937', marginBottom: '0.5rem' }}>
              No Reports or Complaints
            </h3>
            <p style={{ color: '#6B7280' }}>
              Great! You have no reports or complaints filed against your store.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {complaints.map((complaint) => (
              <div key={complaint.id} style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E5E7EB',
                borderRadius: '12px',
                padding: '1.5rem',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ 
                      fontSize: '1.125rem', 
                      fontWeight: '600', 
                      color: '#1F2937',
                      marginBottom: '0.25rem'
                    }}>
                      {complaint.type === 'store_report' ? '📍 Store Report' : 'Complaint'} #{complaint.complaintId?.split('_')[1] || complaint.id?.slice(-8) || 'Unknown'}
                    </h3>
                    <p style={{ color: '#6B7280', fontSize: '0.875rem' }}>
                      Filed on {formatDate(complaint.timestamp || complaint.submittedAt)}
                    </p>
                    {complaint.type === 'store_report' && (
                      <div style={{
                        display: 'inline-block',
                        backgroundColor: '#7C3AED20',
                        color: '#7C3AED',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        marginTop: '0.25rem'
                      }}>
                        Store Report
                      </div>
                    )}
                  </div>
                  <div style={{
                    backgroundColor: getStatusColor(complaint.status),
                    color: 'white',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: '600'
                  }}>
                    {getStatusText(complaint.status)}
                  </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    <div>
                      <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.25rem' }}>
                        {complaint.type === 'store_report' ? 'Reporter' : 'Customer'}
                      </p>
                      <p style={{ color: '#6B7280' }}>
                        {complaint.reporterName || complaint.customerName || 'Unknown'}
                      </p>
                      <p style={{ color: '#6B7280', fontSize: '0.875rem' }}>
                        {complaint.reporterEmail || complaint.customerEmail || 'N/A'}
                      </p>
                    </div>
                    {complaint.type === 'store_report' ? (
                      <div>
                        <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.25rem' }}>
                          Report Reason
                        </p>
                        <p style={{ color: '#DC2626', fontWeight: '600' }}>
                          {complaint.reason ? complaint.reason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Unknown'}
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.25rem' }}>
                          Order ID
                        </p>
                        <p style={{ color: '#6B7280', fontFamily: 'monospace' }}>
                          {complaint.refundData?.orderId || 'Unknown'}
                        </p>
                      </div>
                    )}
                    {complaint.refundData ? (
                      <div>
                        <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.25rem' }}>
                          Refund Amount
                        </p>
                        <p style={{ color: '#6B7280' }}>
                          {getCurrencySymbol(complaint.refundData?.currency || 'GBP')}
                          {formatPrice(complaint.refundData?.amount || 0, complaint.refundData?.currency || 'GBP')}
                        </p>
                      </div>
                    ) : complaint.type === 'store_report' ? (
                      <div>
                        <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.25rem' }}>
                          Report Type  
                        </p>
                        <div style={{
                          backgroundColor: '#FEE2E2',
                          color: '#DC2626',
                          padding: '0.25rem 0.75rem',
                          borderRadius: '6px',
                          fontSize: '0.875rem',
                          fontWeight: '600'
                        }}>
                          Store Violation
                        </div>
                      </div>
                    ) : null}
                    <div>
                      <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.25rem' }}>
                        Issue Type
                      </p>
                      <p style={{ color: '#6B7280' }}>
                        {complaint.reason 
                          ? complaint.reason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                          : complaint.complaintType?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown'
                        }
                      </p>
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                    {complaint.type === 'store_report' ? 'Report Details' : 'Customer Explanation'}
                  </p>
                  <div style={{
                    backgroundColor: '#F9FAFB',
                    border: '1px solid #E5E7EB',
                    borderRadius: '6px',
                    padding: '0.75rem',
                    fontSize: '0.875rem',
                    color: '#374151'
                  }}>
                    {complaint.details || complaint.explanation || 'No details provided'}
                  </div>
                </div>

                {complaint.screenshots && complaint.screenshots.length > 0 && (
                  <div style={{ marginBottom: '1rem' }}>
                    <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                      Customer Screenshots ({complaint.screenshots.length})
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {complaint.screenshots.map((screenshot, index) => (
                        <a
                          key={index}
                          href={screenshot.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-block',
                            backgroundColor: '#3B82F6',
                            color: 'white',
                            padding: '0.5rem 1rem',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            fontSize: '0.875rem',
                            fontWeight: '500'
                          }}
                        >
                          📸 {screenshot.name || `Screenshot ${index + 1}`}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{
                  backgroundColor: '#FEF3C7',
                  border: '1px solid #F59E0B',
                  borderRadius: '6px',
                  padding: '0.75rem',
                  fontSize: '0.875rem'
                }}>
                  <p style={{ color: '#92400E', fontWeight: '600', marginBottom: '0.25rem' }}>
                    ⚠️ Important Note
                  </p>
                  <p style={{ color: '#92400E' }}>
                    This complaint has been submitted to the admin for review. 
                    You will be contacted if additional information is required.
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ReportsPage;
