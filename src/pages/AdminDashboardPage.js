import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, signOut } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

function AdminDashboardPage() {
  const navigate = useNavigate();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);

  useEffect(() => {
    // Check if user is admin
    const checkAdminAuth = async () => {
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user) {
        navigate('/admin-login');
        return;
      }

      try {
        const adminDoc = await getDoc(doc(db, 'admins', user.uid));
        if (!adminDoc.exists()) {
          navigate('/admin-login');
          return;
        }
      } catch (error) {
        console.error('Admin auth check error:', error);
        navigate('/admin-login');
        return;
      }

      // If admin is verified, load complaints
      loadComplaints();
    };

    checkAdminAuth();
  }, [navigate]);

  const loadComplaints = () => {
    const complaintsQuery = query(
      collection(db, 'admin_complaints'),
      orderBy('submittedAt', 'desc')
    );

    const unsubscribe = onSnapshot(complaintsQuery, (snapshot) => {
      const complaintsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setComplaints(complaintsData);
      setLoading(false);
    });

    return unsubscribe;
  };

  const handleStatusUpdate = async (complaintId, newStatus) => {
    setUpdateLoading(true);
    try {
      await updateDoc(doc(db, 'admin_complaints', complaintId), {
        status: newStatus,
        updatedAt: new Date()
      });
      
      // Update local state
      setComplaints(prev => prev.map(complaint => 
        complaint.id === complaintId 
          ? { ...complaint, status: newStatus }
          : complaint
      ));

      setShowModal(false);
      setSelectedComplaint(null);
    } catch (error) {
      console.error('Error updating complaint status:', error);
      alert('Error updating complaint status');
    }
    setUpdateLoading(false);
  };

  const handleLogout = async () => {
    try {
      const auth = getAuth();
      await signOut(auth);
      navigate('/admin-login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending_review': return '#EF4444'; // Red
      case 'new': return '#EF4444'; // Red
      case 'investigating': return '#F59E0B'; // Yellow
      case 'resolved': return '#10B981'; // Green
      case 'rejected': return '#6B7280'; // Gray
      default: return '#6B7280';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending_review': return '🆕';
      case 'new': return '🆕';
      case 'investigating': return '🔍';
      case 'resolved': return '✅';
      case 'rejected': return '❌';
      default: return '❓';
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '1.5rem',
        color: '#6B7280'
      }}>
        Loading admin dashboard...
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#F9FAFB', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #E5E7EB',
        padding: '1rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h1 style={{
          fontSize: '1.875rem',
          fontWeight: 'bold',
          color: '#1F2937',
          margin: 0
        }}>
          🛡️ Admin Dashboard
        </h1>
        <button
          onClick={handleLogout}
          style={{
            backgroundColor: '#EF4444',
            color: 'white',
            border: 'none',
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          Logout
        </button>
      </div>

      {/* Stats */}
      <div style={{ padding: '2rem' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem'
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '1.5rem',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#6B7280', fontSize: '0.875rem' }}>Total Complaints</h3>
            <p style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold', color: '#1F2937' }}>
              {complaints.length}
            </p>
          </div>
          <div style={{
            backgroundColor: 'white',
            padding: '1.5rem',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#6B7280', fontSize: '0.875rem' }}>New/Unresolved</h3>
            <p style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold', color: '#EF4444' }}>
              {complaints.filter(c => c.status === 'pending_review' || c.status === 'investigating' || c.status === 'new').length}
            </p>
          </div>
          <div style={{
            backgroundColor: 'white',
            padding: '1.5rem',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#6B7280', fontSize: '0.875rem' }}>Resolved</h3>
            <p style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold', color: '#10B981' }}>
              {complaints.filter(c => c.status === 'resolved').length}
            </p>
          </div>
        </div>

        {/* Complaints List */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '1.5rem',
            borderBottom: '1px solid #E5E7EB',
            backgroundColor: '#F9FAFB'
          }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold', color: '#1F2937' }}>
              Customer Complaints
            </h2>
          </div>

          {complaints.length === 0 ? (
            <div style={{
              padding: '3rem',
              textAlign: 'center',
              color: '#6B7280'
            }}>
              No complaints found
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F9FAFB' }}>
                    <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #E5E7EB', fontWeight: '600', color: '#374151' }}>Date</th>
                    <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #E5E7EB', fontWeight: '600', color: '#374151' }}>Customer</th>
                    <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #E5E7EB', fontWeight: '600', color: '#374151' }}>Shop</th>
                    <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #E5E7EB', fontWeight: '600', color: '#374151' }}>Issue</th>
                    <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #E5E7EB', fontWeight: '600', color: '#374151' }}>Status</th>
                    <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #E5E7EB', fontWeight: '600', color: '#374151' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {complaints.map((complaint) => (
                    <tr key={complaint.id}>
                      <td style={{ padding: '1rem', borderBottom: '1px solid #E5E7EB' }}>
                        {complaint.submittedAt ? new Date(complaint.submittedAt).toLocaleDateString() : 'N/A'}
                      </td>
                      <td style={{ padding: '1rem', borderBottom: '1px solid #E5E7EB' }}>
                        <div>
                          <div style={{ fontWeight: '600' }}>{complaint.customerName || 'Unknown'}</div>
                          <div style={{ fontSize: '0.875rem', color: '#6B7280' }}>{complaint.customerEmail}</div>
                        </div>
                      </td>
                      <td style={{ padding: '1rem', borderBottom: '1px solid #E5E7EB' }}>
                        <div>
                          <div style={{ fontWeight: '600' }}>{complaint.shopInfo?.businessName || 'Unknown Shop'}</div>
                          <div style={{ fontSize: '0.875rem', color: '#6B7280' }}>{complaint.shopInfo?.email || 'N/A'}</div>
                        </div>
                      </td>
                      <td style={{ padding: '1rem', borderBottom: '1px solid #E5E7EB', maxWidth: '300px' }}>
                        <div style={{ 
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {complaint.explanation || complaint.message || 'No details provided'}
                        </div>
                      </td>
                      <td style={{ padding: '1rem', borderBottom: '1px solid #E5E7EB' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.25rem 0.75rem',
                          borderRadius: '9999px',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          backgroundColor: getStatusColor(complaint.status) + '20',
                          color: getStatusColor(complaint.status)
                        }}>
                          {getStatusIcon(complaint.status)}
                          {complaint.status || 'new'}
                        </span>
                      </td>
                      <td style={{ padding: '1rem', borderBottom: '1px solid #E5E7EB' }}>
                        <button
                          onClick={() => {
                            setSelectedComplaint(complaint);
                            setShowModal(true);
                          }}
                          style={{
                            backgroundColor: '#3B82F6',
                            color: 'white',
                            border: 'none',
                            padding: '0.5rem 1rem',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.875rem'
                          }}
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && selectedComplaint && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '2rem',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.5rem', fontWeight: 'bold' }}>
              Manage Complaint
            </h3>

            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#374151' }}>Customer Details</h4>
              <p style={{ margin: '0.25rem 0', color: '#6B7280' }}>
                <strong>Name:</strong> {selectedComplaint.customerName || 'Unknown'}
              </p>
              <p style={{ margin: '0.25rem 0', color: '#6B7280' }}>
                <strong>Email:</strong> {selectedComplaint.customerEmail}
              </p>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#374151' }}>Shop Details</h4>
              <p style={{ margin: '0.25rem 0', color: '#6B7280' }}>
                <strong>Business:</strong> {selectedComplaint.shopInfo?.businessName || selectedComplaint.sellerName || 'N/A'}
              </p>
              <p style={{ margin: '0.25rem 0', color: '#6B7280' }}>
                <strong>Email:</strong> {selectedComplaint.shopInfo?.email || selectedComplaint.sellerEmail || 'N/A'}
              </p>
              {selectedComplaint.shopInfo?.address && (
                <p style={{ margin: '0.25rem 0', color: '#6B7280' }}>
                  <strong>Address:</strong> {selectedComplaint.shopInfo.address}
                </p>
              )}
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#374151' }}>Complaint Details</h4>
              {selectedComplaint.complaintType && (
                <p style={{ margin: '0.25rem 0', color: '#6B7280' }}>
                  <strong>Type:</strong> {selectedComplaint.complaintType.replace('_', ' ').toUpperCase()}
                </p>
              )}
              {selectedComplaint.refundData && (
                <div style={{ margin: '0.5rem 0', padding: '1rem', backgroundColor: '#F9FAFB', borderRadius: '6px' }}>
                  <strong>Related Order:</strong>
                  <p style={{ margin: '0.25rem 0', fontSize: '0.875rem' }}>Order ID: {selectedComplaint.refundData.orderId}</p>
                  <p style={{ margin: '0.25rem 0', fontSize: '0.875rem' }}>Amount: {selectedComplaint.refundData.currency || 'GBP'} {selectedComplaint.refundData.amount}</p>
                </div>
              )}
              <p style={{ margin: '0.5rem 0', color: '#374151', lineHeight: '1.5' }}>
                {selectedComplaint.explanation || selectedComplaint.message || 'No details provided'}
              </p>
              {selectedComplaint.screenshots && selectedComplaint.screenshots.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <p style={{ margin: '0 0 0.5rem 0', fontWeight: '600', color: '#374151' }}>Screenshot Evidence:</p>
                  {selectedComplaint.screenshots.map((screenshot, index) => (
                    <div key={index} style={{ marginBottom: '0.5rem' }}>
                      <img 
                        src={screenshot.url} 
                        alt={`Complaint Evidence ${index + 1}`}
                        style={{
                          maxWidth: '100%',
                          height: 'auto',
                          borderRadius: '6px',
                          border: '1px solid #E5E7EB',
                          marginBottom: '0.5rem'
                        }}
                      />
                      <p style={{ fontSize: '0.75rem', color: '#6B7280', margin: 0 }}>{screenshot.name}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <h4 style={{ margin: '0 0 1rem 0', color: '#374151' }}>Update Status</h4>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {['pending_review', 'investigating', 'resolved', 'rejected'].map(status => (
                  <button
                    key={status}
                    onClick={() => handleStatusUpdate(selectedComplaint.id, status)}
                    disabled={updateLoading}
                    style={{
                      padding: '0.5rem 1rem',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: updateLoading ? 'not-allowed' : 'pointer',
                      fontWeight: '600',
                      backgroundColor: selectedComplaint.status === status ? getStatusColor(status) : '#F3F4F6',
                      color: selectedComplaint.status === status ? 'white' : '#374151'
                    }}
                  >
                    {getStatusIcon(status)} {status}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowModal(false);
                  setSelectedComplaint(null);
                }}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  backgroundColor: 'white',
                  color: '#374151',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboardPage;
