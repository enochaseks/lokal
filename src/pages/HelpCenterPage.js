import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { Link } from 'react-router-dom';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useMessage } from '../MessageContext';

// Helper function to get category from subject
const getCategoryFromSubject = (subject) => {
  const subjectLower = subject.toLowerCase();
  
  if (subjectLower.includes('store') || subjectLower.includes('seller')) {
    return 'seller_issues';
  } else if (subjectLower.includes('payment') || subjectLower.includes('refund')) {
    return 'payment_issues';
  } else if (subjectLower.includes('account') || subjectLower.includes('login')) {
    return 'account_issues';
  } else if (subjectLower.includes('order') || subjectLower.includes('delivery')) {
    return 'order_issues';
  } else if (subjectLower.includes('technical') || subjectLower.includes('bug')) {
    return 'technical_issues';
  } else {
    return 'general_support';
  }
};

function HelpCenterPage() {
  const [helpTopic, setHelpTopic] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showUnauthSupportModal, setShowUnauthSupportModal] = useState(false);
  const [supportForm, setSupportForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
    userType: '', // 'buyer' or 'seller'
    includeAccountInfo: true
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { allMessages } = useMessage();
  
  // Function to handle support requests from unauthenticated users
  const handleUnauthenticatedSupport = () => {
    // Instead of showing a modal, we'll set the help topic to a new value
    setHelpTopic('unauthenticated-support');
  };
  
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsLoggedIn(!!user);
      setCurrentUser(user);
      
      // Pre-fill form with user info if logged in
      if (user) {
        setSupportForm(prev => ({
          ...prev,
          name: user.displayName || '',
          email: user.email || ''
        }));
      }
    });
    return () => unsubscribe();
  }, []);

  // Common styles for help topic pages
  const topicStyles = {
    h1: { fontSize: '1.8rem', fontWeight: 700, color: '#007B7F', marginBottom: '20px' },
    h2: { fontSize: '1.4rem', fontWeight: 600, color: '#333', marginTop: '30px', marginBottom: '15px' },
    p: { fontSize: '1.05rem', lineHeight: '1.6', marginBottom: '15px', color: '#444' },
    ul: { paddingLeft: '25px', marginBottom: '20px' },
    li: { fontSize: '1.05rem', marginBottom: '10px', lineHeight: '1.5' },
    infoBox: {
      backgroundColor: '#f0f7f7',
      border: '1px solid #d0e0e0',
      borderRadius: '8px',
      padding: '15px 20px',
      marginBottom: '20px'
    },
    steps: {
      counter: { 
        backgroundColor: '#007B7F',
        color: 'white',
        width: '30px',
        height: '30px',
        borderRadius: '50%',
        display: 'inline-flex',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: '15px',
        fontWeight: 'bold'
      },
      container: {
        display: 'flex',
        alignItems: 'flex-start',
        marginBottom: '20px'
      },
      content: {
        flex: 1
      }
    },
    image: {
      maxWidth: '100%',
      height: 'auto',
      border: '1px solid #ddd',
      borderRadius: '8px',
      marginBottom: '20px'
    }
  };

  // Custom header for unauthenticated users
  const UnauthenticatedHeader = () => (
    <header style={{ 
      width: '100%', 
      padding: '1rem', 
      backgroundColor: '#fff', 
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      position: 'fixed',
      top: 0,
      left: 0,
      zIndex: 1000,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
          <img src="/images/logo png.png" alt="Lokal Logo" style={{ height: '36px', marginRight: '10px' }} />
          <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#007B7F' }}>Lokal</span>
        </Link>
      </div>
      <div>
        <Link to="/login" style={{ 
          textDecoration: 'none',
          color: '#007B7F',
          fontWeight: '600',
          marginRight: '20px'
        }}>
          Login
        </Link>
        <Link to="/register" style={{ 
          textDecoration: 'none',
          backgroundColor: '#007B7F',
          color: 'white',
          padding: '8px 16px',
          borderRadius: '4px',
          fontWeight: '600'
        }}>
          Sign Up
        </Link>
      </div>
    </header>
  );

  // Help Topic view
  if (helpTopic) {
    return (
      <div style={{ background: '#F0F2F5', minHeight: '100vh' }}>
        <Navbar />
        <div style={{ maxWidth: 800, margin: '2rem auto', marginTop: '2rem', background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px #B8B8B8', padding: '2rem' }}>
          <button onClick={() => setHelpTopic('')} style={{ marginBottom: 18, background: 'none', border: 'none', color: '#007B7F', fontWeight: 600, fontSize: '1.1rem', cursor: 'pointer' }}>{'< Back to Help Center'}</button>
          
          {/* Failed Transactions Content */}
          {helpTopic === 'failed-transactions' && (
            <div>
              <h1 style={topicStyles.h1}>Failed Transactions: Troubleshooting Guide</h1>
              
              <div style={topicStyles.infoBox}>
                <p><strong>Important:</strong> If you've experienced a failed transaction on Lokal, don't worry. Most issues can be resolved quickly by following the steps below.</p>
              </div>
              
              <h2 style={topicStyles.h2}>Common Reasons for Transaction Failures</h2>
              <ul style={topicStyles.ul}>
                <li style={topicStyles.li}>Insufficient funds in your account</li>
                <li style={topicStyles.li}>Card expired or card details entered incorrectly</li>
                <li style={topicStyles.li}>Bank declined the transaction for security reasons</li>
                <li style={topicStyles.li}>Network connectivity issues during payment processing</li>
                <li style={topicStyles.li}>Daily spending limit reached on your payment method</li>
                <li style={topicStyles.li}>Payment method not supported in your region</li>
              </ul>
              
              <h2 style={topicStyles.h2}>Steps to Resolve Failed Transactions</h2>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>1</div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Check Your Payment Method</h3>
                  <p>Verify that your card hasn't expired and that you have sufficient funds available. Contact your bank if you're unsure why the payment was declined.</p>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>2</div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Try Alternative Payment Options</h3>
                  <p>Lokal supports multiple payment methods. If a card payment fails, you can try:</p>
                  <ul>
                    <li>Google Pay (available in supported regions)</li>
                    <li>Bank transfers (direct to seller's account)</li>
                    <li>Different card or payment method</li>
                  </ul>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>3</div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Check for Pending Transactions</h3>
                  <p>Sometimes the transaction might have been processed by your bank despite showing an error in our system. Check your bank statement for any pending charges before attempting the purchase again.</p>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>4</div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Try Bank Transfer Option</h3>
                  <p>For direct purchases from sellers, you can use the bank transfer option. This allows you to:</p>
                  <ul>
                    <li>Transfer money directly to the seller's account</li>
                    <li>Use your online banking app or visit your bank</li>
                    <li>Complete the purchase even if card payments are failing</li>
                    <li>Confirm your payment by uploading proof of transfer</li>
                  </ul>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>5</div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Contact Support</h3>
                  <p>If you're still experiencing issues, please contact our support team with the following information:</p>
                  <ul>
                    <li>Date and time of the attempted transaction</li>
                    <li>Exact error message received (screenshot if possible)</li>
                    <li>Payment method used and last 4 digits of the card if applicable</li>
                    <li>Order ID if available</li>
                  </ul>
                  <button 
                    onClick={() => isLoggedIn ? setHelpTopic('contact-support') : handleUnauthenticatedSupport()} 
                    style={{
                      backgroundColor: '#007B7F',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '8px 15px',
                      cursor: 'pointer',
                      fontSize: '0.95rem',
                      marginTop: '10px'
                    }}
                  >
                    Contact Support
                  </button>
                </div>
              </div>
              
              <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
                <h3 style={{ fontSize: '1.15rem', marginBottom: '10px', color: '#333' }}>FAQs about Failed Transactions</h3>
                <p><strong>Q: Will I be charged twice if I retry my payment?</strong></p>
                <p>A: No, our payment system prevents double-charging. However, your bank might place a temporary authorization hold that will be released in 3-7 business days.</p>
                
                <p><strong>Q: My payment failed but money was deducted from my account. What should I do?</strong></p>
                <p>A: This is usually a temporary authorization hold, not an actual charge. The funds will be released by your bank within 3-7 business days. If not, please contact support with your transaction details.</p>
                
                <p><strong>Q: Can I pay with Google Pay or bank transfer if card payment fails?</strong></p>
                <p>A: Yes, Lokal offers multiple payment options. If your card payment fails, you can choose Google Pay (where available) or bank transfer as alternative methods.</p>
                
                <p><strong>Q: Can I reserve my items while I resolve payment issues?</strong></p>
                <p>A: Items in your cart are not reserved until payment is complete. We recommend resolving payment issues promptly to secure your purchase.</p>
              </div>
            </div>
          )}
          
          {/* Refund Requests Content */}
          {helpTopic === 'refund-requests' && (
            <div>
              <h1 style={topicStyles.h1}>How to Request and Process Refunds</h1>
              
              <div style={topicStyles.infoBox}>
                <p><strong>Important Update:</strong> The refund system has been enhanced. All refund requests now require seller approval before processing, and order statuses will clearly show "Cancelled & Refunded" when a refund has been completed. Refund policies are set by individual sellers, and most allow refund requests within 14 days of purchase.</p>
              </div>
              
              <h2 style={topicStyles.h2}>For Customers: How to Request a Refund</h2>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>1</div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Open Messages with Seller</h3>
                  <p>Go to the Messages section and select the conversation with the seller from whom you made the purchase.</p>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>2</div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Find the Order</h3>
                  <p>Locate the order in your message history with the seller. Look for order confirmation messages that include payment details and order status.</p>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>3</div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Click "Cancel & Request Refund"</h3>
                  <p>Find and click the "Cancel & Request Refund" button associated with your order. This will open a refund request form.</p>
                  <ul>
                    <li>Select a reason for the refund from the dropdown menu (required)</li>
                    <li>Provide additional details about your request in the details field</li>
                    <li>Review the information carefully before submitting</li>
                  </ul>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>4</div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Submit and Wait for Seller Approval</h3>
                  <p>After submitting your request:</p>
                  <ul>
                    <li>A refund request message is sent to the seller</li>
                    <li>The seller must review and approve your request</li>
                    <li>You'll be notified in the message thread when the seller approves or denies your refund</li>
                    <li>If approved, the order status will change to "Cancelled & Refunded"</li>
                    <li>Refund processing time depends on your original payment method</li>
                  </ul>
                </div>
              </div>
              
              <h2 style={topicStyles.h2}>For Sellers: Processing Refund Requests</h2>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>1</div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Review Refund Requests</h3>
                  <p>Check your Messages for refund requests from customers. You'll see a "🔄 Refund Request" notification in the conversation with detailed information including:</p>
                  <ul>
                    <li>Reason for the refund request</li>
                    <li>Additional details provided by the customer</li>
                    <li>Refund amount and original payment method</li>
                  </ul>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>2</div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Approve or Deny the Request</h3>
                  <p>After reviewing the refund request, you must decide whether to approve or deny it:</p>
                  <ul>
                    <li>Click "Approve Refund" if you agree to process the refund</li>
                    <li>Click "Deny Refund" if you're declining the request (you'll need to provide a reason)</li>
                    <li>This step is mandatory - refunds will not process without your explicit approval</li>
                  </ul>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>3</div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Refund Processing</h3>
                  <p>After approval, the refund is processed differently based on payment method:</p>
                  <ul>
                    <li><strong>Card/Digital Payments:</strong> Refunds are processed automatically through Stripe and will appear in the customer's account within 2-5 business days</li>
                    <li><strong>Bank Transfers:</strong> You'll need to manually transfer the refund to the customer and then upload proof of the transfer</li>
                    <li><strong>Wallet Payments:</strong> Funds will be automatically returned to the customer's wallet</li>
                  </ul>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>4</div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Confirmation and Customer Communication</h3>
                  <p>After approving or denying a refund:</p>
                  <ul>
                    <li>An automatic message is sent to the customer with your decision</li>
                    <li>For approved refunds, the message includes refund amount and processing details</li>
                    <li>For denied refunds, the message includes your explanation</li>
                    <li>You can add additional comments to maintain good customer relationships</li>
                  </ul>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>5</div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Tracking Refund Status</h3>
                  <p>After processing refunds:</p>
                  <ul>
                    <li>The order status will update to <strong>"Cancelled & Refunded"</strong> in the order history</li>
                    <li>Your Wallet/Transactions page will show the refund with status <strong>"Cancelled & Refunded"</strong></li>
                    <li>Generated receipts will be preserved in your Reports section for record-keeping</li>
                    <li>You can view the full refund history in your Reports section</li>
                  </ul>
                </div>
              </div>
              
              <div style={{ marginTop: '25px', backgroundColor: '#f0f7ff', border: '1px solid #cce5ff', borderRadius: '8px', padding: '15px', marginBottom: '20px' }}>
                <h3 style={{ color: '#0066cc', fontSize: '1.1rem', marginBottom: '10px' }}>Important Reminder for Sellers</h3>
                <p style={{ lineHeight: '1.6' }}>All refund requests require your review and explicit approval. Refunds will not be processed automatically without your action. Be sure to check your messages regularly to respond to customer refund requests in a timely manner. After processing, all refunds will be clearly marked as "Cancelled & Refunded" in your transaction history.</p>
              </div>
              
              <h2 style={topicStyles.h2}>Refund Policy Settings for Sellers</h2>
              <p style={topicStyles.p}>As a seller, you can configure your refund policy in your store settings:</p>
              <ul style={topicStyles.ul}>
                <li style={topicStyles.li}><strong>Enable/Disable Refunds:</strong> Toggle the "refundsEnabled" setting to control whether customers can request refunds</li>
                <li style={topicStyles.li}><strong>Refund Window:</strong> Standard refund window is 14 days, but you can specify a different timeframe in your store terms</li>
                <li style={topicStyles.li}><strong>Refund Communication:</strong> Always communicate your refund policy clearly to customers before they make a purchase</li>
                <li style={topicStyles.li}><strong>Receipt Generation:</strong> You can generate and send receipts for refunded orders from your Reports section</li>
              </ul>
              
              <div style={{ marginTop: '20px', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '1.15rem', marginBottom: '10px' }}>Refund Approval Flow</h3>
                <ol style={{ paddingLeft: '20px' }}>
                  <li style={{ marginBottom: '8px' }}><strong>Customer submits refund request</strong> with reason and details</li>
                  <li style={{ marginBottom: '8px' }}><strong>Seller receives notification</strong> in message conversation</li>
                  <li style={{ marginBottom: '8px' }}><strong>Seller reviews and approves/denies</strong> the refund request</li>
                  <li style={{ marginBottom: '8px' }}><strong>System processes approved refunds</strong> based on original payment method</li>
                  <li style={{ marginBottom: '8px' }}><strong>Order status updates to "Cancelled & Refunded"</strong> in both seller and buyer views</li>
                  <li style={{ marginBottom: '8px' }}><strong>Confirmation sent to customer</strong> with refund status and details</li>
                </ol>
              </div>
              
              <div style={{ marginTop: '30px' }}>
                <p style={{ fontStyle: 'italic', color: '#666' }}>For additional help with refund requests, please contact our support team:</p>
                <button 
                  onClick={() => isLoggedIn ? setHelpTopic('contact-support') : handleUnauthenticatedSupport()} 
                  style={{
                    backgroundColor: '#007B7F',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '8px 15px',
                    cursor: 'pointer',
                    fontSize: '0.95rem'
                  }}
                >
                  Contact Support
                </button>
              </div>
            </div>
          )}
          
          {/* Bank Details Content */}
          {helpTopic === 'bank-details' && (
            <div>
              <h1 style={topicStyles.h1}>Setting Up Your Bank Details</h1>
              
              <div style={topicStyles.infoBox}>
                <p><strong>Important:</strong> Adding your bank details is essential for receiving payments as a seller and for customers to make direct bank transfers. Ensure all information is accurate to avoid payment delays.</p>
              </div>
              
              <h2 style={topicStyles.h2}>How to Add Your Bank Account (For Sellers)</h2>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>1</div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Access Payment Settings</h3>
                  <p>Go to "Settings" and select the "Payment" option from the menu.</p>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>2</div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Select Payment Type</h3>
                  <p>Choose "Own Card/Bank Details" as your payment type.</p>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>3</div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Select Your Country</h3>
                  <p>Choose your country from the dropdown menu. Lokal supports multiple countries with different banking systems:</p>
                  <ul>
                    <li>UK (Sort code and account number)</li>
                    <li>Nigeria (Account number and bank name)</li>
                    <li>USA (Routing number and account number)</li>
                    <li>Canada (Transit number and account number)</li>
                    <li>South Africa (Account number and branch code)</li>
                    <li>Ghana (Account number and mobile money)</li>
                    <li>Kenya (Account number and mobile money)</li>
                    <li>Jamaica/Trinidad & Tobago (Account number and branch code)</li>
                    <li>Other countries (Custom format)</li>
                  </ul>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>4</div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Enter Your Bank Details</h3>
                  <p>Enter the required bank information for your selected country. For example:</p>
                  <ul>
                    <li><strong>UK:</strong> Sort code, account number, bank name</li>
                    <li><strong>USA:</strong> Routing number, account number, bank name</li>
                    <li><strong>Nigeria:</strong> Account number, bank name</li>
                  </ul>
                  <p>All information must match your bank records exactly.</p>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>5</div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Save Your Information</h3>
                  <p>Review all details for accuracy and click "Save" to store your bank information securely. Your information will be encrypted for security.</p>
                </div>
              </div>
              
              <h2 style={topicStyles.h2}>Bank Transfer Payments (For Buyers)</h2>
              <p style={topicStyles.p}>When making a purchase with bank transfer:</p>
              <ol style={{ paddingLeft: '25px', marginBottom: '20px' }}>
                <li style={{ marginBottom: '10px' }}><strong>Select bank transfer</strong> as your payment method during checkout</li>
                <li style={{ marginBottom: '10px' }}><strong>Get seller's bank details</strong> displayed on the payment page</li>
                <li style={{ marginBottom: '10px' }}><strong>Make the transfer</strong> through your banking app or at your bank branch</li>
                <li style={{ marginBottom: '10px' }}><strong>Provide transfer confirmation</strong> with reference number, date, and amount</li>
                <li style={{ marginBottom: '10px' }}><strong>Wait for verification</strong> by the seller (usually within 1-2 business days)</li>
              </ol>
              
              <h2 style={topicStyles.h2}>Withdrawals to Your Bank Account</h2>
              <p style={topicStyles.p}>As a seller, you can withdraw your earnings to your bank account:</p>
              <ul style={topicStyles.ul}>
                <li style={topicStyles.li}><strong>Go to Messages Tab:</strong> Access your wallet from the messages page</li>
                <li style={topicStyles.li}><strong>Select Withdraw:</strong> Choose the amount you wish to withdraw</li>
                <li style={topicStyles.li}><strong>Select Bank Account:</strong> Withdraw to your registered bank account</li>
                <li style={topicStyles.li}><strong>Processing Time:</strong> Withdrawals typically take 2-5 business days to appear in your account</li>
                <li style={topicStyles.li}><strong>Minimum Withdrawal:</strong> There may be a minimum withdrawal amount depending on your region</li>
              </ul>
              
              <div style={{ marginTop: '25px', backgroundColor: '#fff8e6', border: '1px solid #ffe0b2', borderRadius: '8px', padding: '15px', marginBottom: '20px' }}>
                <h3 style={{ color: '#d97706', fontSize: '1.1rem', marginBottom: '10px' }}>Security Notice</h3>
                <p style={{ lineHeight: '1.6' }}>We take your financial security seriously. All bank details are encrypted and stored securely using masking technology that hides most of the digits except the last few. Our team will never ask for your full bank details via email or phone. If you receive such requests, please report them immediately.</p>
              </div>
              
              <h2 style={topicStyles.h2}>Bank Transfer Security Tips</h2>
              <ul style={topicStyles.ul}>
                <li style={topicStyles.li}><strong>Always verify the seller</strong> before making a bank transfer</li>
                <li style={topicStyles.li}><strong>Use the reference code</strong> provided by Lokal for all transfers</li>
                <li style={topicStyles.li}><strong>Keep transfer receipts</strong> until your order is complete</li>
                <li style={topicStyles.li}><strong>Never share your online banking credentials</strong> with anyone</li>
                <li style={topicStyles.li}><strong>Report suspicious activity</strong> to Lokal Support immediately</li>
              </ul>
              
              <div style={{ marginTop: '30px' }}>
                <p style={{ fontStyle: 'italic', color: '#666' }}>Need more help with setting up your bank details?</p>
                <button 
                  onClick={() => isLoggedIn ? setHelpTopic('contact-support') : handleUnauthenticatedSupport()} 
                  style={{
                    backgroundColor: '#007B7F',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '8px 15px',
                    cursor: 'pointer',
                    fontSize: '0.95rem'
                  }}
                >
                  Contact Support
                </button>
              </div>
            </div>
          )}
          
          {/* Store Creation Guide Content */}
          {helpTopic === 'store-creation' && (
            <div>
              <h1 style={topicStyles.h1}>Store Creation Guide</h1>
              
              <div style={topicStyles.infoBox}>
                <p><strong>Getting Started:</strong> Setting up your store on Lokal follows a specific onboarding flow. This guide will walk you through the actual process of becoming a seller on our platform.</p>
              </div>
              
              <h2 style={topicStyles.h2}>Requirements Before You Begin</h2>
              <ul style={topicStyles.ul}>
                <li style={topicStyles.li}>Valid email address and account on Lokal</li>
                <li style={topicStyles.li}>Information about what type of goods you'll be selling</li>
                <li style={topicStyles.li}>Your business location details</li>
                <li style={topicStyles.li}>Business documentation (varies based on your business type)</li>
                <li style={topicStyles.li}>Bank account or payment details for receiving payments</li>
                <li style={topicStyles.li}>High-quality background image for your store</li>
              </ul>
              
              <h2 style={topicStyles.h2}>Step-by-Step Guide</h2>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>1</div>
                <div style={topicStyles.steps.content}>
                  <h3 style={{ fontSize: '1.2rem', marginTop: 0, marginBottom: '10px' }}>Initial Onboarding</h3>
                  <p style={topicStyles.p}>When you first sign up for Lokal, you'll be asked "Why are you on Lokal?" Select the option "I want to sell" to begin the seller onboarding process.</p>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>2</div>
                <div style={topicStyles.steps.content}>
                  <h3 style={{ fontSize: '1.2rem', marginTop: 0, marginBottom: '10px' }}>Select Selling Category</h3>
                  <p style={topicStyles.p}>Choose what type of goods you'll be selling from the available options: Foods & Goods, Meat & Poultry, Wholesale, or Beauty & Hair. This helps us tailor your store experience.</p>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>3</div>
                <div style={topicStyles.steps.content}>
                  <h3 style={{ fontSize: '1.2rem', marginTop: 0, marginBottom: '10px' }}>Specify Your Selling Location</h3>
                  <p style={topicStyles.p}>Select where you'll be selling from: In a store, Market, or Online. Based on your selection, you'll need to provide specific details:</p>
                  <ul style={topicStyles.ul}>
                    <li style={topicStyles.li}><strong>In a store:</strong> Store name, address, and business documentation</li>
                    <li style={topicStyles.li}><strong>Market:</strong> Market name, location, and relevant licenses</li>
                    <li style={topicStyles.li}><strong>Online:</strong> Platform details, social handles, and shipping information</li>
                  </ul>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>4</div>
                <div style={topicStyles.steps.content}>
                  <h3 style={{ fontSize: '1.2rem', marginTop: 0, marginBottom: '10px' }}>Upload Required Documentation</h3>
                  <p style={topicStyles.p}>Depending on your business type and location, you'll need to upload certain documents:</p>
                  <ul style={topicStyles.ul}>
                    <li style={topicStyles.li}>Business ID or certificate</li>
                    <li style={topicStyles.li}>Food hygiene certificate (if selling food products)</li>
                    <li style={topicStyles.li}>Market stall license (for market vendors)</li>
                    <li style={topicStyles.li}>Alcohol license (if applicable)</li>
                  </ul>
                  <p style={topicStyles.p}>These documents help us verify your business and ensure compliance with local regulations.</p>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>5</div>
                <div style={topicStyles.steps.content}>
                  <h3 style={{ fontSize: '1.2rem', marginTop: 0, marginBottom: '10px' }}>Create Your Shop</h3>
                  <p style={topicStyles.p}>After completing the onboarding flow, you'll be directed to create your shop profile:</p>
                  <ul style={topicStyles.ul}>
                    <li style={topicStyles.li}>Upload a background image for your store</li>
                    <li style={topicStyles.li}>Select your delivery options (Collection or Delivery)</li>
                    <li style={topicStyles.li}>Set up payment information</li>
                  </ul>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>6</div>
                <div style={topicStyles.steps.content}>
                  <h3 style={{ fontSize: '1.2rem', marginTop: 0, marginBottom: '10px' }}>Set Up Payment Methods</h3>
                  <p style={topicStyles.p}>Choose your preferred payment method and enter your banking details based on your country:</p>
                  <ul style={topicStyles.ul}>
                    <li style={topicStyles.li}><strong>UK:</strong> Sort code, account number, bank name</li>
                    <li style={topicStyles.li}><strong>USA:</strong> Routing number, account number, bank name</li>
                    <li style={topicStyles.li}><strong>Nigeria:</strong> Account number, bank name</li>
                    <li style={topicStyles.li}><strong>Ghana/Kenya:</strong> Account number, bank name, mobile money number</li>
                    <li style={topicStyles.li}>And other country-specific options</li>
                  </ul>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>7</div>
                <div style={topicStyles.steps.content}>
                  <h3 style={{ fontSize: '1.2rem', marginTop: 0, marginBottom: '10px' }}>Manage Your Store Profile</h3>
                  <p style={topicStyles.p}>Once your shop is created, you'll access your Store Profile page where you can:</p>
                  <ul style={topicStyles.ul}>
                    <li style={topicStyles.li}>Add products to your inventory</li>
                    <li style={topicStyles.li}>Set opening and closing times</li>
                    <li style={topicStyles.li}>Edit store details</li>
                    <li style={topicStyles.li}>Toggle your store between online and offline</li>
                  </ul>
                </div>
              </div>
              
              <h2 style={topicStyles.h2}>Going Live with Your Store</h2>
              <p style={topicStyles.p}>Before your store can go live, you need to have:</p>
              <ul style={topicStyles.ul}>
                <li style={topicStyles.li}>A background image</li>
                <li style={topicStyles.li}>A store name</li>
                <li style={topicStyles.li}>A valid location</li>
                <li style={topicStyles.li}>Country of origin</li>
                <li style={topicStyles.li}>Selected delivery type</li>
                <li style={topicStyles.li}>At least one product in your inventory</li>
              </ul>
              <p style={topicStyles.p}>Once these requirements are met, you can click the "Go Live" button to make your store visible to customers.</p>
              
              <div style={topicStyles.infoBox}>
                <p><strong>Need more help?</strong> Check out our guides on <a href="#" onClick={(e) => { e.preventDefault(); setHelpTopic('adding-products'); }} style={{ color: '#007B7F', textDecoration: 'none' }}>Adding Products to Your Inventory</a> and <a href="#" onClick={(e) => { e.preventDefault(); setHelpTopic('payment-methods'); }} style={{ color: '#007B7F', textDecoration: 'none' }}>Setting up Payment Methods</a>.</p>
              </div>
            </div>
          )}
          
          {/* Adding Products to Inventory */}
          {helpTopic === 'adding-products' && (
            <div>
              <h1 style={topicStyles.h1}>Adding Products to Your Inventory</h1>
              
              <div style={topicStyles.infoBox}>
                <p><strong>Showcase Your Products:</strong> Adding products to your store inventory is essential for making sales on Lokal. This guide will show you how to add products based on the platform's actual functionality.</p>
              </div>
              
              <h2 style={topicStyles.h2}>Before Adding Products</h2>
              <p style={topicStyles.p}>Make sure you have the following information ready for each product:</p>
              <ul style={topicStyles.ul}>
                <li style={topicStyles.li}>Product image (one clear, high-quality image)</li>
                <li style={topicStyles.li}>Product name</li>
                <li style={topicStyles.li}>Price in your local currency</li>
                <li style={topicStyles.li}>Quality description (e.g., Excellent, Good, Fair)</li>
                <li style={topicStyles.li}>Available quantity</li>
              </ul>
              
              <h2 style={topicStyles.h2}>Step-by-Step Guide</h2>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>1</div>
                <div style={topicStyles.steps.content}>
                  <h3 style={{ fontSize: '1.2rem', marginTop: 0, marginBottom: '10px' }}>Access Your Store Profile</h3>
                  <p style={topicStyles.p}>After logging into your Lokal account, navigate to your Store Profile page where you manage your store.</p>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>2</div>
                <div style={topicStyles.steps.content}>
                  <h3 style={{ fontSize: '1.2rem', marginTop: 0, marginBottom: '10px' }}>Find the Add Item Option</h3>
                  <p style={topicStyles.p}>On your Store Profile page, you'll see an "Add Item" button. Click this to open the product entry form.</p>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>3</div>
                <div style={topicStyles.steps.content}>
                  <h3 style={{ fontSize: '1.2rem', marginTop: 0, marginBottom: '10px' }}>Upload Product Image</h3>
                  <p style={topicStyles.p}>Click on the image upload area to select and upload a photo of your product. This is the main image customers will see when browsing your store.</p>
                  <p style={topicStyles.p}><strong>Pro tip:</strong> Use well-lit, clear images that accurately show your product. Square images with dimensions of at least 500x500 pixels work best.</p>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>4</div>
                <div style={topicStyles.steps.content}>
                  <h3 style={{ fontSize: '1.2rem', marginTop: 0, marginBottom: '10px' }}>Enter Product Name</h3>
                  <p style={topicStyles.p}>Type in a clear, descriptive name for your product. Be specific but concise - this helps customers find your product.</p>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>5</div>
                <div style={topicStyles.steps.content}>
                  <h3 style={{ fontSize: '1.2rem', marginTop: 0, marginBottom: '10px' }}>Set Price and Currency</h3>
                  <p style={topicStyles.p}>Enter the price of your item and select the appropriate currency from the dropdown menu (GBP, USD, EUR, NGN, etc.).</p>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>6</div>
                <div style={topicStyles.steps.content}>
                  <h3 style={{ fontSize: '1.2rem', marginTop: 0, marginBottom: '10px' }}>Specify Quality</h3>
                  <p style={topicStyles.p}>Choose or enter a quality descriptor for your product (e.g., "Excellent," "Good," "New," "Used," etc.). This helps set customer expectations.</p>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>7</div>
                <div style={topicStyles.steps.content}>
                  <h3 style={{ fontSize: '1.2rem', marginTop: 0, marginBottom: '10px' }}>Set Quantity</h3>
                  <p style={topicStyles.p}>Enter the number of items you have available for sale. This helps track your inventory and prevents overselling.</p>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>8</div>
                <div style={topicStyles.steps.content}>
                  <h3 style={{ fontSize: '1.2rem', marginTop: 0, marginBottom: '10px' }}>Save Your Product</h3>
                  <p style={topicStyles.p}>Review all information for accuracy and click the "Add" button to add your product to your store inventory.</p>
                </div>
              </div>
              
              <h2 style={topicStyles.h2}>Going Live with Your Store</h2>
              <p style={topicStyles.p}>Important things to remember about your inventory:</p>
              <ul style={topicStyles.ul}>
                <li style={topicStyles.li}>You must add at least one product before your store can go live</li>
                <li style={topicStyles.li}>All products added are immediately visible once your store is live</li>
                <li style={topicStyles.li}>You can add more products at any time</li>
                <li style={topicStyles.li}>Currently, the platform doesn't support editing products after they've been added - you'll need to add a new product if you need changes</li>
              </ul>
              
              <h2 style={topicStyles.h2}>Best Practices</h2>
              <ul style={topicStyles.ul}>
                <li style={topicStyles.li}>Use clear, descriptive product names</li>
                <li style={topicStyles.li}>Set fair, competitive prices</li>
                <li style={topicStyles.li}>Be honest about product quality</li>
                <li style={topicStyles.li}>Keep your inventory updated to reflect actual availability</li>
                <li style={topicStyles.li}>Add new products regularly to keep customers engaged</li>
              </ul>
              
              <div style={topicStyles.infoBox}>
                <p><strong>Need more help?</strong> Check out our guides on <a href="#" onClick={(e) => { e.preventDefault(); setHelpTopic('store-creation'); }} style={{ color: '#007B7F', textDecoration: 'none' }}>Store Creation</a> or <a href="#" onClick={(e) => { e.preventDefault(); setHelpTopic('payment-methods'); }} style={{ color: '#007B7F', textDecoration: 'none' }}>Setting up Payment Methods</a>.</p>
              </div>
            </div>
          )}
          
          {/* Setting up payment methods */}
          {helpTopic === 'payment-methods' && (
            <div>
              <h1 style={topicStyles.h1}>Setting Up Payment Methods</h1>
              
              <div style={topicStyles.infoBox}>
                <p><strong>Get Paid Easily:</strong> Setting up your payment information during store creation is crucial for receiving payments from customers on Lokal.</p>
              </div>
              
              <h2 style={topicStyles.h2}>When to Set Up Payment Methods</h2>
              <p style={topicStyles.p}>You'll be prompted to set up your payment information during the store creation process. This is an important step that cannot be skipped, as it determines how you'll receive funds from sales.</p>
              
              <h2 style={topicStyles.h2}>Available Payment Options</h2>
              <p style={topicStyles.p}>Lokal supports various payment methods depending on your location:</p>
              <ul style={topicStyles.ul}>
                <li style={topicStyles.li}><strong>Direct Bank Transfer</strong> - Standard bank account deposit</li>
                <li style={topicStyles.li}><strong>Mobile Money</strong> - For supported countries like Ghana and Kenya</li>
                <li style={topicStyles.li}><strong>Card Payments</strong> - Process through your merchant account</li>
              </ul>
              
              <h2 style={topicStyles.h2}>Step-by-Step Payment Setup</h2>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>1</div>
                <div style={topicStyles.steps.content}>
                  <h3 style={{ fontSize: '1.2rem', marginTop: 0, marginBottom: '10px' }}>Choose Payment Type</h3>
                  <p style={topicStyles.p}>In the store creation flow, after setting up your store details and delivery options, you'll be prompted to select your preferred payment type. Click on "Payment Type" to view the available options.</p>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>2</div>
                <div style={topicStyles.steps.content}>
                  <h3 style={{ fontSize: '1.2rem', marginTop: 0, marginBottom: '10px' }}>Select Your Country</h3>
                  <p style={topicStyles.p}>Choose your country from the dropdown menu. The payment information fields will change based on your selected country, as different countries have different banking systems and requirements.</p>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>3</div>
                <div style={topicStyles.steps.content}>
                  <h3 style={{ fontSize: '1.2rem', marginTop: 0, marginBottom: '10px' }}>Enter Banking Details</h3>
                  <p style={topicStyles.p}>Based on your country selection, you'll need to provide specific banking information:</p>
                  <ul style={topicStyles.ul}>
                    <li style={topicStyles.li}><strong>United Kingdom:</strong> Sort code, account number, bank name, and expiry date</li>
                    <li style={topicStyles.li}><strong>United States:</strong> Routing number, account number, and bank name</li>
                    <li style={topicStyles.li}><strong>Nigeria:</strong> Account number and bank name</li>
                    <li style={topicStyles.li}><strong>Ghana:</strong> Account number, bank name, and mobile money number</li>
                    <li style={topicStyles.li}><strong>Kenya:</strong> Account number, bank name, and mobile money number</li>
                    <li style={topicStyles.li}><strong>South Africa:</strong> Account number, bank name, and branch code</li>
                    <li style={topicStyles.li}><strong>Canada:</strong> Transit number, account number, and bank name</li>
                    <li style={topicStyles.li}><strong>Caribbean:</strong> Account number, bank name, and branch code</li>
                  </ul>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>4</div>
                <div style={topicStyles.steps.content}>
                  <h3 style={{ fontSize: '1.2rem', marginTop: 0, marginBottom: '10px' }}>Add Card Information (If Applicable)</h3>
                  <p style={topicStyles.p}>If you've selected to receive payments via card, you'll need to specify the card type that you're set up to accept for processing payments.</p>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>5</div>
                <div style={topicStyles.steps.content}>
                  <h3 style={{ fontSize: '1.2rem', marginTop: 0, marginBottom: '10px' }}>Confirm and Complete</h3>
                  <p style={topicStyles.p}>Review all your payment information for accuracy before submitting. Once you confirm, this information will be saved with your store profile.</p>
                </div>
              </div>
              
              <h2 style={topicStyles.h2}>Security Measures</h2>
              <p style={topicStyles.p}>Lokal takes the security of your financial information seriously:</p>
              <ul style={topicStyles.ul}>
                <li style={topicStyles.li}>All banking details are encrypted during transmission and storage</li>
                <li style={topicStyles.li}>Sensitive account numbers are masked when displayed (e.g., ****1234)</li>
                <li style={topicStyles.li}>Access to payment information is strictly controlled</li>
              </ul>
              
              <h2 style={topicStyles.h2}>How Payments Work</h2>
              <p style={topicStyles.p}>Understanding the payment flow on Lokal:</p>
              <ul style={topicStyles.ul}>
                <li style={topicStyles.li}>When customers purchase from your store, the payment is processed based on your selected payment method</li>
                <li style={topicStyles.li}>You'll receive notifications of new orders and payments</li>
                <li style={topicStyles.li}>Funds are transferred to your designated account based on the payment information you provided</li>
                <li style={topicStyles.li}>Payment processing times vary by payment method and country</li>
              </ul>
              
              <div style={topicStyles.infoBox}>
                <p><strong>Need assistance?</strong> If you have questions about setting up your payment details or are experiencing issues with payments, contact our <a href="#" onClick={(e) => { e.preventDefault(); isLoggedIn ? setHelpTopic('contact-support') : handleUnauthenticatedSupport(); }} style={{ color: '#007B7F', textDecoration: 'none' }}>Support Team</a> for help.</p>
              </div>
            </div>
          )}

          {/* Contact Support Form */}
          {helpTopic === 'contact-support' && (
            <div>
              <h1 style={topicStyles.h1}>Contact Support</h1>
              
              <div style={topicStyles.infoBox}>
                <p><strong>We're here to help!</strong> Our customer support team is ready to assist you with any questions or issues you may have.</p>
              </div>
              
              <h2 style={topicStyles.h2}>Send Us a Message</h2>
              <p style={topicStyles.p}>Please fill out the form below with details about your inquiry, and we'll get back to you as soon as possible.</p>
              
              <form style={{ marginTop: '20px' }}>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 500 }}>Name</label>
                  <input 
                    type="text" 
                    placeholder="Your full name"
                    style={{ 
                      width: '100%', 
                      padding: '10px', 
                      border: '1px solid #ddd', 
                      borderRadius: '4px',
                      fontSize: '1rem'
                    }} 
                  />
                </div>
                
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 500 }}>Email Address</label>
                  <input 
                    type="email" 
                    placeholder="your.email@example.com"
                    style={{ 
                      width: '100%', 
                      padding: '10px', 
                      border: '1px solid #ddd', 
                      borderRadius: '4px',
                      fontSize: '1rem'
                    }} 
                  />
                </div>
                
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 500 }}>Subject</label>
                  <select 
                    style={{ 
                      width: '100%', 
                      padding: '10px', 
                      border: '1px solid #ddd', 
                      borderRadius: '4px',
                      fontSize: '1rem',
                      backgroundColor: '#fff'
                    }}
                  >
                    <option value="">Select a topic</option>
                    <option value="account">Account Issues</option>
                    <option value="payment">Payment Problems</option>
                    <option value="store">Store Setup</option>
                    <option value="products">Product Management</option>
                    <option value="orders">Order Issues</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 500 }}>Message</label>
                  <textarea 
                    placeholder="Please describe your issue in detail"
                    rows={6}
                    style={{ 
                      width: '100%', 
                      padding: '10px', 
                      border: '1px solid #ddd', 
                      borderRadius: '4px',
                      fontSize: '1rem',
                      resize: 'vertical'
                    }} 
                  />
                </div>
                
                <div style={{ marginBottom: '15px' }}>
                  <input type="checkbox" id="attachLogs" />
                  <label htmlFor="attachLogs" style={{ marginLeft: '8px' }}>Include account information to help us assist you faster</label>
                </div>
                
                <button 
                  type="button" 
                  onClick={() => alert('Support request submitted! We will contact you soon.')}
                  style={{ 
                    backgroundColor: '#007B7F', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '4px', 
                    padding: '12px 25px', 
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Submit Request
                </button>
              </form>
              
              <h2 style={topicStyles.h2}>Other Ways to Contact Us</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginTop: '20px' }}>
                <div style={{ flex: '1 1 250px', padding: '20px', border: '1px solid #e0e0e0', borderRadius: '8px' }}>
                  <h3 style={{ margin: '0 0 10px 0', color: '#007B7F' }}>Email Support</h3>
                  <p style={{ margin: '0 0 10px 0' }}>helplokal@gmail.com</p>
                  <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>Response within 24 hours</p>
                </div>
                
                <div style={{ flex: '1 1 250px', padding: '20px', border: '1px solid #e0e0e0', borderRadius: '8px' }}>
                  <h3 style={{ margin: '0 0 10px 0', color: '#007B7F' }}>Instagram Support</h3>
                  <p style={{ margin: '0 0 10px 0' }}><a href="https://instagram.com/lokaladmin" target="_blank" rel="noopener noreferrer" style={{ color: '#007B7F', textDecoration: 'none' }}>@lokaladmin</a></p>
                  <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>Direct message us for quick assistance</p>
                </div>
              </div>
            </div>
          )}

          {/* Unauthenticated Support Content */}
          {helpTopic === 'unauthenticated-support' && (
            <div>
              <h1 style={topicStyles.h1}>Contact Support</h1>
              
              <div style={topicStyles.infoBox}>
                <p><strong>Thanks for contacting us!</strong> Since you're not currently logged in, please use one of the following methods to reach our support team:</p>
              </div>
              
              <div style={{ marginTop: '25px', marginBottom: '25px', display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
                <div style={{ flex: '1 1 250px', padding: '20px', backgroundColor: '#f0f7f7', border: '1px solid #d0e0e0', borderRadius: '8px' }}>
                  <h3 style={{ margin: '0 0 10px 0', color: '#007B7F' }}>Email Support</h3>
                  <p style={{ margin: '0 0 5px 0' }}>
                    <strong>Email:</strong> <a href="mailto:helplokal@gmail.com" style={{ color: '#007B7F', textDecoration: 'none' }}>helplokal@gmail.com</a>
                  </p>
                  <p style={{ margin: '5px 0 0 0', color: '#666', fontSize: '0.9rem' }}>Response within 24 hours</p>
                </div>
                
                <div style={{ flex: '1 1 250px', padding: '20px', backgroundColor: '#f0f7f7', border: '1px solid #d0e0e0', borderRadius: '8px' }}>
                  <h3 style={{ margin: '0 0 10px 0', color: '#007B7F' }}>Instagram Support</h3>
                  <p style={{ margin: '0 0 5px 0' }}>
                    <strong>Instagram:</strong> <a href="https://instagram.com/lokaladmin" target="_blank" rel="noopener noreferrer" style={{ color: '#007B7F', textDecoration: 'none' }}>@lokaladmin</a>
                  </p>
                  <p style={{ margin: '5px 0 0 0', color: '#666', fontSize: '0.9rem' }}>Direct message us for quick assistance</p>
                </div>
              </div>
              
              <div style={{ marginTop: '30px', padding: '20px', border: '1px solid #007B7F', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
                <h3 style={{ margin: '0 0 15px 0', color: '#007B7F' }}>Create an Account for Full Support</h3>
                <p style={{ margin: '0 0 15px 0' }}>
                  For faster and more personalized support, including order tracking and refund assistance, we recommend creating a Lokal account or logging in.
                </p>
                <div style={{ display: 'flex', gap: '15px' }}>
                  <Link to="/login" style={{ 
                    padding: '10px 20px',
                    backgroundColor: '#007B7F',
                    color: 'white',
                    textDecoration: 'none',
                    borderRadius: '4px',
                    fontWeight: '600',
                    textAlign: 'center'
                  }}>
                    Log In
                  </Link>
                  <Link to="/register" style={{ 
                    padding: '10px 20px',
                    backgroundColor: 'white',
                    color: '#007B7F',
                    textDecoration: 'none',
                    border: '1px solid #007B7F',
                    borderRadius: '4px',
                    fontWeight: '600',
                    textAlign: 'center'
                  }}>
                    Sign Up
                  </Link>
                </div>
              </div>
              
              <div style={{ marginTop: '30px' }}>
                <button 
                  onClick={() => setHelpTopic('')}
                  style={{
                    backgroundColor: '#eee',
                    color: '#333',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    padding: '8px 15px',
                    cursor: 'pointer',
                    fontSize: '0.95rem'
                  }}
                >
                  Back to Help Topics
                </button>
              </div>
            </div>
          )}

          {/* Update Profile Information Content */}
          {helpTopic === 'update-profile' && (
            <div>
              <h1 style={topicStyles.h1}>Updating Your Profile Information</h1>
              
              <div style={topicStyles.infoBox}>
                <p><strong>Important:</strong> Keeping your profile information up-to-date ensures a smooth experience on Lokal and helps both buyers and sellers communicate effectively.</p>
              </div>
              
              <h2 style={topicStyles.h2}>How to Update Your Profile</h2>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>1</div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Access Your Profile Settings</h3>
                  <p>Click on your profile icon in the top right corner of the page, then select "Profile" from the dropdown menu.</p>
                  <div style={{ marginTop: '10px', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '10px', backgroundColor: '#f9f9f9' }}>
                    <p><strong>Tip:</strong> You can also access your profile directly by going to the Profile page in the navigation menu.</p>
                  </div>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>2</div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Click "Edit Profile"</h3>
                  <p>Look for the "Edit Profile" button on your profile page. Clicking this will open a modal where you can update your information.</p>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>3</div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Update Your Information</h3>
                  <p>You can update the following information:</p>
                  <ul>
                    <li><strong>Name:</strong> Your display name on the platform</li>
                    <li><strong>Location:</strong> Your city or region</li>
                    <li><strong>Profile Photo:</strong> Upload a new image to represent you on the platform</li>
                  </ul>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>4</div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Save Your Changes</h3>
                  <p>Click the "Save" button to apply your changes. Your profile will be updated immediately.</p>
                </div>
              </div>
              
              <h2 style={topicStyles.h2}>Updating Store Profile Information (For Sellers)</h2>
              <p style={topicStyles.p}>If you're a seller, you may need to update your store information as well:</p>
              
              <ol style={{ marginBottom: '20px', paddingLeft: '20px' }}>
                <li style={{ marginBottom: '10px' }}><strong>Go to your Store Profile page</strong> from your dashboard</li>
                <li style={{ marginBottom: '10px' }}><strong>Click on "Edit Profile"</strong> to modify store details</li>
                <li style={{ marginBottom: '10px' }}><strong>Update store information</strong> including store name, location, business hours, etc.</li>
                <li style={{ marginBottom: '10px' }}><strong>Save your changes</strong> to update your store profile</li>
              </ol>
              
              <div style={{ padding: '15px', backgroundColor: '#FEF9C3', borderLeft: '4px solid #EAB308', borderRadius: '4px', marginBottom: '20px' }}>
                <p style={{ margin: 0, fontWeight: 500 }}>⚠️ Important Note About Store Name and Location Changes:</p>
                <p style={{ margin: '10px 0 0 0' }}>For sellers, changing your store name or location is limited to maintain platform integrity. You'll need to provide a reason for these changes, and frequent changes may be restricted.</p>
              </div>
              
              <div style={{ marginTop: '30px' }}>
                <p style={{ fontStyle: 'italic', color: '#666' }}>Need additional help updating your profile? Contact our support team:</p>
                <button 
                  onClick={() => isLoggedIn ? setHelpTopic('contact-support') : handleUnauthenticatedSupport()}
                  style={{
                    backgroundColor: '#007B7F',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '8px 15px',
                    cursor: 'pointer',
                    fontSize: '0.95rem'
                  }}
                >
                  Contact Support
                </button>
              </div>
            </div>
          )}

          {/* Password Reset Content */}
          {helpTopic === 'password-reset' && (
            <div>
              <h1 style={topicStyles.h1}>Password Reset Guide</h1>
              
              <div style={topicStyles.infoBox}>
                <p><strong>Need to reset your password?</strong> Follow these steps to create a new, secure password for your Lokal account.</p>
              </div>
              
              <h2 style={topicStyles.h2}>How to Reset Your Password</h2>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>1</div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Go to the Login Page</h3>
                  <p>Navigate to the Lokal login page by clicking "Login" in the navigation menu.</p>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>2</div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Click "Forgot Password?"</h3>
                  <p>Look for the "Forgot Password?" link below the login form and click on it.</p>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>3</div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Enter Your Email Address</h3>
                  <p>Enter the email address associated with your Lokal account and click the "Reset Password" button.</p>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>4</div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Check Your Email</h3>
                  <p>Check your inbox for an email from Lokal with a password reset link. Be sure to check your spam or junk folder if you don't see it in your inbox.</p>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>5</div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Create a New Password</h3>
                  <p>Click the link in the email and create a new, secure password. Your password should be:</p>
                  <ul>
                    <li>At least 8 characters long</li>
                    <li>Include uppercase and lowercase letters</li>
                    <li>Include at least one number</li>
                    <li>Include at least one special character (e.g., !@#$%^&*)</li>
                  </ul>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>6</div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Log In With Your New Password</h3>
                  <p>After successfully changing your password, return to the login page and sign in with your new password.</p>
                </div>
              </div>
              
              <div style={{ padding: '15px', backgroundColor: '#FEF9C3', borderLeft: '4px solid #EAB308', borderRadius: '4px', marginBottom: '20px', marginTop: '20px' }}>
                <p style={{ margin: 0, fontWeight: 500 }}>⚠️ Password Reset Tips:</p>
                <ul style={{ marginTop: '10px', marginBottom: 0, paddingLeft: '20px' }}>
                  <li>Password reset links are valid for 30 minutes</li>
                  <li>Don't share your password with anyone</li>
                  <li>Consider using a password manager to securely store your passwords</li>
                  <li>Avoid using the same password across multiple websites</li>
                </ul>
              </div>
              
              <div style={{ marginTop: '30px' }}>
                <p style={{ fontStyle: 'italic', color: '#666' }}>Still having trouble? Contact our support team:</p>
                <button 
                  onClick={() => isLoggedIn ? setHelpTopic('contact-support') : handleUnauthenticatedSupport()}
                  style={{
                    backgroundColor: '#007B7F',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '8px 15px',
                    cursor: 'pointer',
                    fontSize: '0.95rem'
                  }}
                >
                  Contact Support
                </button>
              </div>
            </div>
          )}

          {/* Account Security Content */}
          {helpTopic === 'account-security' && (
            <div>
              <h1 style={topicStyles.h1}>Account Security</h1>
              
              <div style={topicStyles.infoBox}>
                <p><strong>Protecting your account is our top priority.</strong> Learn how to keep your Lokal account secure and protect your personal information.</p>
              </div>
              
              <h2 style={topicStyles.h2}>Best Practices for Account Security</h2>
              
              <div style={{ marginBottom: '25px' }}>
                <h3 style={{ fontSize: '1.1rem', color: '#007B7F', marginBottom: '10px' }}>Create a Strong Password</h3>
                <p>A strong password is your first line of defense. Make sure your password:</p>
                <ul style={topicStyles.ul}>
                  <li style={topicStyles.li}>Is at least 8 characters long</li>
                  <li style={topicStyles.li}>Contains uppercase and lowercase letters</li>
                  <li style={topicStyles.li}>Includes numbers and special characters (!@#$%^&*)</li>
                  <li style={topicStyles.li}>Is not used for any other accounts</li>
                  <li style={topicStyles.li}>Does not contain personal information (name, birthdate)</li>
                </ul>
              </div>
              
              <div style={{ marginBottom: '25px' }}>
                <h3 style={{ fontSize: '1.1rem', color: '#007B7F', marginBottom: '10px' }}>Regularly Update Your Password</h3>
                <p>We recommend changing your password every 3-6 months. To update your password:</p>
                <ol style={{ paddingLeft: '20px' }}>
                  <li>Go to Settings</li>
                  <li>Select the "Account" tab</li>
                  <li>Click on "Change Password"</li>
                  <li>Follow the prompts to create a new password</li>
                </ol>
              </div>
              
              <div style={{ marginBottom: '25px' }}>
                <h3 style={{ fontSize: '1.1rem', color: '#007B7F', marginBottom: '10px' }}>Monitor Your Account Activity</h3>
                <p>Regularly check your recent activity for any unauthorized actions:</p>
                <ul style={topicStyles.ul}>
                  <li style={topicStyles.li}>Review your order history</li>
                  <li style={topicStyles.li}>Check your message conversations</li>
                  <li style={topicStyles.li}>Monitor your payment history</li>
                  <li style={topicStyles.li}>Verify your profile information hasn't changed</li>
                </ul>
              </div>
              
              <div style={{ marginBottom: '25px' }}>
                <h3 style={{ fontSize: '1.1rem', color: '#007B7F', marginBottom: '10px' }}>Keep Your Contact Information Updated</h3>
                <p>Ensure your email address and phone number are current. These are used to verify your identity and recover your account if needed.</p>
              </div>
              
              <div style={{ marginBottom: '25px' }}>
                <h3 style={{ fontSize: '1.1rem', color: '#007B7F', marginBottom: '10px' }}>Be Aware of Phishing Attempts</h3>
                <p>Lokal will never ask for your password via email or messages. Be suspicious of:</p>
                <ul style={topicStyles.ul}>
                  <li style={topicStyles.li}>Emails asking for your password or financial information</li>
                  <li style={topicStyles.li}>Messages with urgent requests about your account</li>
                  <li style={topicStyles.li}>Links that don't lead to the official Lokal website</li>
                  <li style={topicStyles.li}>Attachments you weren't expecting</li>
                </ul>
              </div>
              
              <div style={{ padding: '15px', backgroundColor: '#FEF9C3', borderLeft: '4px solid #EAB308', borderRadius: '4px', marginBottom: '20px' }}>
                <p style={{ margin: 0, fontWeight: 500 }}>⚠️ What to Do If You Suspect Your Account Has Been Compromised:</p>
                <ol style={{ marginTop: '10px', marginBottom: 0, paddingLeft: '20px' }}>
                  <li><strong>Reset your password immediately</strong></li>
                  <li><strong>Check for any unauthorized changes</strong> to your account information</li>
                  <li><strong>Review your order and payment history</strong> for suspicious activity</li>
                  <li><strong>Contact our support team</strong> right away</li>
                </ol>
              </div>
              
              <div style={{ marginTop: '30px' }}>
                <p style={{ fontStyle: 'italic', color: '#666' }}>Have security concerns about your account? Contact our support team immediately:</p>
                <button 
                  onClick={() => isLoggedIn ? setHelpTopic('contact-support') : handleUnauthenticatedSupport()}
                  style={{
                    backgroundColor: '#007B7F',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '8px 15px',
                    cursor: 'pointer',
                    fontSize: '0.95rem'
                  }}
                >
                  Contact Support
                </button>
              </div>
            </div>
          )}

          {/* Making a Purchase Content */}
          {helpTopic === 'making-purchase' && (
            <div>
              <h1 style={topicStyles.h1}>Making a Purchase</h1>
              
              <div style={topicStyles.infoBox}>
                <p><strong>Shopping on Lokal is simple and secure!</strong> Follow these steps to make your first purchase.</p>
              </div>
              
              <h2 style={topicStyles.h2}>Step-by-step Purchase Guide</h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                  <div style={topicStyles.steps.counter}>1</div>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Browse and Select Items</h3>
                    <p>Browse stores and products by category, location, or using the search bar. Click on products to view details and add them to your cart.</p>
                    <ul>
                      <li>View high-quality photos and detailed descriptions</li>
                      <li>Check seller ratings and reviews before purchasing</li>
                      <li>See delivery options and estimated timeframes</li>
                    </ul>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                  <div style={topicStyles.steps.counter}>2</div>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Start a Conversation</h3>
                    <p>Use the messaging feature to discuss details with the seller. You can:</p>
                    <ul>
                      <li>Ask questions about the product</li>
                      <li>Request custom options if available</li>
                      <li>Discuss delivery arrangements</li>
                    </ul>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                  <div style={topicStyles.steps.counter}>3</div>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Review Your Cart</h3>
                    <p>Check your cart before proceeding to payment:</p>
                    <ul>
                      <li>Verify all items are correct</li>
                      <li>Review quantities and prices</li>
                      <li>Check the subtotal and any additional fees</li>
                    </ul>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                  <div style={topicStyles.steps.counter}>4</div>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Choose Payment Method</h3>
                    <p>Select your preferred payment option:</p>
                    <ul>
                      <li>Credit/debit card</li>
                      <li>Apple Pay/Google Pay (where available)</li>
                      <li>Bank transfer (for some sellers)</li>
                    </ul>
                    <p>All payment information is securely processed and never shared with sellers.</p>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                  <div style={topicStyles.steps.counter}>5</div>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Complete Purchase</h3>
                    <p>Confirm your order details and complete your purchase. You'll receive:</p>
                    <ul>
                      <li>An order confirmation email</li>
                      <li>Access to order tracking in your account</li>
                      <li>A notification when the seller accepts your order</li>
                    </ul>
                  </div>
                </div>
              </div>
              
              <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
                <h3 style={{ fontSize: '1.15rem', marginBottom: '10px', color: '#333' }}>Purchase Protection Tips</h3>
                <ul>
                  <li>Always communicate through the Lokal platform</li>
                  <li>Never share payment details outside the app</li>
                  <li>Check seller ratings and reviews before purchasing</li>
                  <li>Report any suspicious activity immediately</li>
                </ul>
              </div>
              
              <div style={{ marginTop: '30px' }}>
                <p style={{ fontStyle: 'italic', color: '#666' }}>Need help with making a purchase? Contact our support team:</p>
                <button 
                  onClick={() => isLoggedIn ? setHelpTopic('contact-support') : handleUnauthenticatedSupport()}
                  style={{
                    backgroundColor: '#007B7F',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '8px 15px',
                    cursor: 'pointer',
                    fontSize: '0.95rem'
                  }}
                >
                  Contact Support
                </button>
              </div>
            </div>
          )}

          {/* Tracking Your Order Content */}
          {helpTopic === 'tracking-order' && (
            <div>
              <h1 style={topicStyles.h1}>Tracking Your Order</h1>
              
              <div style={topicStyles.infoBox}>
                <p><strong>Stay updated on your order's progress!</strong> Lokal makes it easy to track orders from purchase to delivery.</p>
              </div>
              
              <h2 style={topicStyles.h2}>How to Track Your Order</h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                  <div style={topicStyles.steps.counter}>1</div>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Access Your Orders</h3>
                    <p>Go to your profile and select the "Orders" tab to view all your purchases.</p>
                    <p>You can also access your orders directly from the confirmation email by clicking "Track Order".</p>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                  <div style={topicStyles.steps.counter}>2</div>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>View Order Details</h3>
                    <p>Click on any order to see complete details including:</p>
                    <ul>
                      <li>Order number and purchase date</li>
                      <li>Items purchased with quantities and prices</li>
                      <li>Seller information and contact options</li>
                      <li>Payment details and total amount</li>
                    </ul>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                  <div style={topicStyles.steps.counter}>3</div>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Check Order Status</h3>
                    <p>Your order will progress through these status updates:</p>
                    <ul>
                      <li><strong>Pending:</strong> Order placed but not yet accepted by seller</li>
                      <li><strong>Accepted:</strong> Seller has confirmed your order</li>
                      <li><strong>Preparing:</strong> Seller is preparing your items</li>
                      <li><strong>Ready for Pickup/Delivery:</strong> Your order is ready</li>
                      <li><strong>In Transit:</strong> Your order is on its way (for delivery)</li>
                      <li><strong>Delivered/Completed:</strong> Order has been delivered or picked up</li>
                    </ul>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                  <div style={topicStyles.steps.counter}>4</div>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Contact the Seller</h3>
                    <p>If you need more information about your order:</p>
                    <ul>
                      <li>Use the "Message Seller" button in your order details</li>
                      <li>Ask about specific delivery times or special instructions</li>
                      <li>Respond promptly to any questions from the seller</li>
                    </ul>
                  </div>
                </div>
              </div>
              
              <h2 style={topicStyles.h2}>Delivery Updates</h2>
              <p>For orders with delivery, you'll receive notifications when:</p>
              <ul>
                <li>Your order is accepted</li>
                <li>Your order is out for delivery</li>
                <li>The delivery is completed</li>
              </ul>
              <p>Many sellers also provide real-time updates through the messaging system.</p>
              
              <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
                <h3 style={{ fontSize: '1.15rem', marginBottom: '10px', color: '#333' }}>When to Contact Support</h3>
                <p>Reach out to Lokal Support if:</p>
                <ul>
                  <li>An order shows "Delivered" but you haven't received it</li>
                  <li>There's no update on your order status for over 48 hours</li>
                  <li>You're unable to contact the seller</li>
                  <li>The delivered items don't match what you ordered</li>
                </ul>
              </div>
              
              <div style={{ marginTop: '30px' }}>
                <p style={{ fontStyle: 'italic', color: '#666' }}>Need help tracking your order? Contact our support team:</p>
                <button 
                  onClick={() => isLoggedIn ? setHelpTopic('contact-support') : handleUnauthenticatedSupport()}
                  style={{
                    backgroundColor: '#007B7F',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '8px 15px',
                    cursor: 'pointer',
                    fontSize: '0.95rem'
                  }}
                >
                  Contact Support
                </button>
              </div>
            </div>
          )}
          
          {/* Leaving Reviews Content */}
          {helpTopic === 'leaving-reviews' && (
            <div>
              <h1 style={topicStyles.h1}>Leaving Reviews</h1>
              
              <div style={topicStyles.infoBox}>
                <p><strong>Help the community with your feedback!</strong> Reviews help other buyers make informed decisions and help sellers improve their services.</p>
              </div>
              
              <h2 style={topicStyles.h2}>How to Leave a Review</h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                  <div style={topicStyles.steps.counter}>1</div>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Find Your Completed Order</h3>
                    <p>Go to your Profile and select the "Orders" tab.</p>
                    <p>Look for orders with the status "Delivered" or "Completed" - these are eligible for reviews.</p>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                  <div style={topicStyles.steps.counter}>2</div>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Open the Review Form</h3>
                    <p>Click on the order you want to review.</p>
                    <p>Find and click the "Leave Review" button that appears for completed orders.</p>
                    <p>You can also visit a store's page and click on the "Reviews" tab to leave a review for any purchase from that store.</p>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                  <div style={topicStyles.steps.counter}>3</div>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Rate Your Experience</h3>
                    <p>Select a star rating from 1-5 stars:</p>
                    <ul>
                      <li>5 stars: Excellent experience, highly recommend</li>
                      <li>4 stars: Good experience with minor issues</li>
                      <li>3 stars: Average experience</li>
                      <li>2 stars: Below average, significant issues</li>
                      <li>1 star: Poor experience, would not recommend</li>
                    </ul>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                  <div style={topicStyles.steps.counter}>4</div>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Write Your Review</h3>
                    <p>Share details about your experience:</p>
                    <ul>
                      <li>Product quality and accuracy to description</li>
                      <li>Seller communication and responsiveness</li>
                      <li>Delivery/pickup experience</li>
                      <li>Overall satisfaction</li>
                    </ul>
                    <p>Be honest, specific, and constructive in your feedback.</p>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                  <div style={topicStyles.steps.counter}>5</div>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Submit Your Review</h3>
                    <p>Click "Submit" to publish your review.</p>
                    <p>Your review will be visible on the seller's store page and helps other customers make informed decisions.</p>
                  </div>
                </div>
              </div>
              
              <h2 style={topicStyles.h2}>Review Guidelines</h2>
              <p>Please follow these guidelines when writing reviews:</p>
              <ul>
                <li><strong>Be honest</strong> - Share your genuine experience</li>
                <li><strong>Be respectful</strong> - Avoid offensive or abusive language</li>
                <li><strong>Be specific</strong> - Include details about what you liked or disliked</li>
                <li><strong>Be relevant</strong> - Focus on the product, service, and seller interaction</li>
              </ul>
              
              <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
                <h3 style={{ fontSize: '1.15rem', marginBottom: '10px', color: '#333' }}>After Submitting a Review</h3>
                <ul>
                  <li>Reviews are published immediately and cannot be edited</li>
                  <li>Sellers may respond to your review</li>
                  <li>Inappropriate reviews may be removed by moderators</li>
                  <li>You can view all your submitted reviews in your profile</li>
                </ul>
              </div>
              
              <div style={{ marginTop: '30px' }}>
                <p style={{ fontStyle: 'italic', color: '#666' }}>Need help with reviews? Contact our support team:</p>
                <button 
                  onClick={() => isLoggedIn ? setHelpTopic('contact-support') : handleUnauthenticatedSupport()}
                  style={{
                    backgroundColor: '#007B7F',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '8px 15px',
                    cursor: 'pointer',
                    fontSize: '0.95rem'
                  }}
                >
                  Contact Support
                </button>
              </div>
            </div>
          )}

          {/* Store Analytics Content */}
          {helpTopic === 'store-analytics' && (
            <div>
              <h1 style={topicStyles.h1}>Understanding Store Analytics</h1>
              
              <div style={topicStyles.infoBox}>
                <p><strong>Track Your Store's Performance:</strong> Lokal's store analytics dashboard provides powerful insights to help you understand your customers, monitor sales trends, and grow your business effectively.</p>
              </div>
              
              <h2 style={topicStyles.h2}>What Are Store Analytics?</h2>
              <p style={topicStyles.p}>Store analytics are comprehensive performance metrics that show how your store is performing on the Lokal platform. These insights help you make data-driven decisions to improve your business.</p>
              
              <h2 style={topicStyles.h2}>Accessing Your Analytics Dashboard</h2>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>1</div>
                <div style={topicStyles.steps.content}>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Navigate to the Explore Page</h3>
                  <p>As a seller, go to the Explore page where you'll find your analytics dashboard displayed prominently at the top of the page.</p>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>2</div>
                <div style={topicStyles.steps.content}>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>View Your Analytics Cards</h3>
                  <p>Your analytics are presented in easy-to-read cards showing key performance indicators for different time periods.</p>
                </div>
              </div>
              
              <h2 style={topicStyles.h2}>Key Metrics Explained</h2>
              
              <div style={{ marginBottom: '25px' }}>
                <h3 style={{ fontSize: '1.1rem', color: '#007B7F', marginBottom: '10px' }}>📊 Total Views</h3>
                <p style={topicStyles.p}>This shows how many times customers have viewed your store or products. A higher number indicates good visibility on the platform.</p>
                <ul style={topicStyles.ul}>
                  <li style={topicStyles.li}><strong>What it means:</strong> Each time a customer clicks on your store or views your products, it counts as a view</li>
                  <li style={topicStyles.li}><strong>Why it matters:</strong> More views typically lead to more potential customers and sales</li>
                  <li style={topicStyles.li}><strong>How to improve:</strong> Optimize your store description, use quality product images, and ensure competitive pricing</li>
                </ul>
              </div>
              
              <div style={{ marginBottom: '25px' }}>
                <h3 style={{ fontSize: '1.1rem', color: '#007B7F', marginBottom: '10px' }}>💬 Message Interactions</h3>
                <p style={topicStyles.p}>Tracks how many customers have started conversations with you about your products or services.</p>
                <ul style={topicStyles.ul}>
                  <li style={topicStyles.li}><strong>What it means:</strong> Customers who message you are highly interested and likely to purchase</li>
                  <li style={topicStyles.li}><strong>Why it matters:</strong> High message counts indicate strong customer engagement</li>
                  <li style={topicStyles.li}><strong>How to improve:</strong> Respond quickly to messages and provide helpful, detailed answers</li>
                </ul>
              </div>
              
              <div style={{ marginBottom: '25px' }}>
                <h3 style={{ fontSize: '1.1rem', color: '#007B7F', marginBottom: '10px' }}>🛒 Add to Cart Actions</h3>
                <p style={topicStyles.p}>Shows how many times customers have added your products to their shopping cart.</p>
                <ul style={topicStyles.ul}>
                  <li style={topicStyles.li}><strong>What it means:</strong> Customers are seriously considering purchasing your products</li>
                  <li style={topicStyles.li}><strong>Why it matters:</strong> This indicates product appeal and purchase intent</li>
                  <li style={topicStyles.li}><strong>How to improve:</strong> Ensure clear product descriptions, competitive pricing, and good product photos</li>
                </ul>
              </div>
              
              <div style={{ marginBottom: '25px' }}>
                <h3 style={{ fontSize: '1.1rem', color: '#007B7F', marginBottom: '10px' }}>✅ Completed Orders</h3>
                <p style={topicStyles.p}>The number of successful transactions and orders fulfilled by your store.</p>
                <ul style={topicStyles.ul}>
                  <li style={topicStyles.li}><strong>What it means:</strong> Actual sales and revenue generated by your store</li>
                  <li style={topicStyles.li}><strong>Why it matters:</strong> This directly impacts your business revenue and growth</li>
                  <li style={topicStyles.li}><strong>How to improve:</strong> Provide excellent customer service, fast delivery, and quality products</li>
                </ul>
              </div>
              
              <h2 style={topicStyles.h2}>Time Period Analysis</h2>
              <p style={topicStyles.p}>Your analytics are broken down into different time periods to help you track trends:</p>
              
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '1.05rem', marginBottom: '8px', color: '#333' }}>📅 Today's Performance</h4>
                <p style={topicStyles.p}>Shows real-time metrics for the current day, helping you understand immediate performance and make quick adjustments.</p>
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '1.05rem', marginBottom: '8px', color: '#333' }}>📅 This Week</h4>
                <p style={topicStyles.p}>Weekly trends help you identify patterns and see how your store performs over a longer period.</p>
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '1.05rem', marginBottom: '8px', color: '#333' }}>📅 This Month</h4>
                <p style={topicStyles.p}>Monthly data provides insights into longer-term trends and seasonal patterns in your business.</p>
              </div>
              
              <h2 style={topicStyles.h2}>Using Analytics to Grow Your Business</h2>
              
              <div style={{ marginBottom: '25px' }}>
                <h3 style={{ fontSize: '1.1rem', color: '#007B7F', marginBottom: '10px' }}>Identify Peak Performance Times</h3>
                <ul style={topicStyles.ul}>
                  <li style={topicStyles.li}>Compare daily, weekly, and monthly metrics to find patterns</li>
                  <li style={topicStyles.li}>Schedule promotions during high-traffic periods</li>
                  <li style={topicStyles.li}>Adjust your availability based on when customers are most active</li>
                </ul>
              </div>
              
              <div style={{ marginBottom: '25px' }}>
                <h3 style={{ fontSize: '1.1rem', color: '#007B7F', marginBottom: '10px' }}>Optimize Your Conversion Funnel</h3>
                <ul style={topicStyles.ul}>
                  <li style={topicStyles.li}>Track the progression from views → messages → cart additions → completed orders</li>
                  <li style={topicStyles.li}>If you have high views but low messages, improve your product descriptions</li>
                  <li style={topicStyles.li}>If you have high cart additions but low completed orders, review your pricing or checkout process</li>
                </ul>
              </div>
              
              <div style={{ marginBottom: '25px' }}>
                <h3 style={{ fontSize: '1.1rem', color: '#007B7F', marginBottom: '10px' }}>Monitor Customer Engagement</h3>
                <ul style={topicStyles.ul}>
                  <li style={topicStyles.li}>High message interactions indicate good customer interest</li>
                  <li style={topicStyles.li}>Quick response times can improve conversion rates</li>
                  <li style={topicStyles.li}>Use customer questions to improve your product listings</li>
                </ul>
              </div>
              
              <h2 style={topicStyles.h2}>Advanced Analytics Features</h2>
              
              <div style={{ marginBottom: '25px' }}>
                <h3 style={{ fontSize: '1.1rem', color: '#007B7F', marginBottom: '10px' }}>📊 Visual Analytics with Pie Charts</h3>
                <p style={topicStyles.p}>Your analytics dashboard includes interactive pie charts that provide visual insights into your store's performance:</p>
                <ul style={topicStyles.ul}>
                  <li style={topicStyles.li}><strong>Performance Breakdown:</strong> See the proportion of views, messages, cart additions, and completed orders</li>
                  <li style={topicStyles.li}><strong>Interactive Display:</strong> Hover over chart segments to see exact numbers and percentages</li>
                  <li style={topicStyles.li}><strong>Color-Coded Segments:</strong> Each metric has its own color for easy identification</li>
                  <li style={topicStyles.li}><strong>Multiple Time Periods:</strong> View separate pie charts for daily, weekly, and monthly data</li>
                </ul>
                
                <div style={{ padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '6px', marginTop: '15px' }}>
                  <h4 style={{ fontSize: '1rem', marginBottom: '8px', color: '#333' }}>Understanding Pie Chart Colors & Segments:</h4>
                  <ul style={{ paddingLeft: '20px', marginBottom: 0 }}>
                    <li><strong>Views:</strong> Typically displayed in blue - represents customer interest and visibility</li>
                    <li><strong>Messages:</strong> Usually shown in green - indicates direct customer engagement</li>
                    <li><strong>Cart Additions:</strong> Often displayed in orange - shows purchase intent</li>
                    <li><strong>Completed Orders:</strong> Generally shown in red - represents actual sales and revenue</li>
                  </ul>
                  <p style={{ marginTop: '10px', marginBottom: 0, fontSize: '0.9rem', fontStyle: 'italic' }}>💡 A healthy conversion funnel typically shows a large "Views" segment with progressively smaller segments for Messages, Cart Additions, and Completed Orders.</p>
                </div>
              </div>
              
              <div style={{ marginBottom: '25px' }}>
                <h3 style={{ fontSize: '1.1rem', color: '#007B7F', marginBottom: '10px' }}>📄 PDF Analytics Reports</h3>
                <p style={topicStyles.p}>Download comprehensive PDF reports of your store analytics for offline review, record-keeping, or sharing:</p>
                
                <div style={topicStyles.steps.container}>
                  <div style={topicStyles.steps.counter}>1</div>
                  <div style={topicStyles.steps.content}>
                    <h4 style={{ fontSize: '1.05rem', marginBottom: '8px' }}>Locate Download Buttons</h4>
                    <p>On your analytics dashboard, you'll find download buttons next to each analytics card. Look for the "📄 PDF" buttons.</p>
                  </div>
                </div>
                
                <div style={topicStyles.steps.container}>
                  <div style={topicStyles.steps.counter}>2</div>
                  <div style={topicStyles.steps.content}>
                    <h4 style={{ fontSize: '1.05rem', marginBottom: '8px' }}>Choose Your Report Type</h4>
                    <p>You can download different types of reports:</p>
                    <ul style={topicStyles.ul}>
                      <li style={topicStyles.li}><strong>Daily Report:</strong> Today's performance metrics and trends</li>
                      <li style={topicStyles.li}><strong>Weekly Report:</strong> This week's analytics summary</li>
                      <li style={topicStyles.li}><strong>Monthly Report:</strong> Comprehensive monthly performance overview</li>
                    </ul>
                  </div>
                </div>
                
                <div style={topicStyles.steps.container}>
                  <div style={topicStyles.steps.counter}>3</div>
                  <div style={topicStyles.steps.content}>
                    <h4 style={{ fontSize: '1.05rem', marginBottom: '8px' }}>What's Included in PDF Reports</h4>
                    <p>Each PDF report contains:</p>
                    <ul style={topicStyles.ul}>
                      <li style={topicStyles.li}>Your store name and report generation date</li>
                      <li style={topicStyles.li}>Complete breakdown of all four key metrics</li>
                      <li style={topicStyles.li}>Visual pie chart representation of your data</li>
                      <li style={topicStyles.li}>Performance insights and trend analysis</li>
                      <li style={topicStyles.li}>Professional formatting suitable for business records</li>
                    </ul>
                  </div>
                </div>
                
                <div style={{ padding: '12px', backgroundColor: '#e6f7f5', borderRadius: '6px', marginTop: '15px' }}>
                  <p style={{ margin: 0, fontWeight: 500 }}>💡 Pro Tip: Download reports regularly to track your store's growth over time and identify successful strategies!</p>
                </div>
              </div>
              
              <h2 style={topicStyles.h2}>Data Updates and Refresh Information</h2>
              
              <div style={{ marginBottom: '25px' }}>
                <h3 style={{ fontSize: '1.1rem', color: '#007B7F', marginBottom: '10px' }}>🔄 Real-Time Data Updates</h3>
                <p style={topicStyles.p}>Your analytics dashboard updates automatically to provide the most current information:</p>
                <ul style={topicStyles.ul}>
                  <li style={topicStyles.li}><strong>Automatic Refresh:</strong> Analytics update every time you visit the Explore page</li>
                  <li style={topicStyles.li}><strong>Real-Time Tracking:</strong> New customer interactions are reflected immediately</li>
                  <li style={topicStyles.li}><strong>Live Counters:</strong> All metrics are calculated from live database queries</li>
                  <li style={topicStyles.li}><strong>No Delays:</strong> Data is current as of the moment you view the dashboard</li>
                </ul>
              </div>
              
              <div style={{ marginBottom: '25px' }}>
                <h3 style={{ fontSize: '1.1rem', color: '#007B7F', marginBottom: '10px' }}>📅 Time Period Calculations</h3>
                <p style={topicStyles.p}>Understanding how time periods are calculated helps you interpret your data correctly:</p>
                <ul style={topicStyles.ul}>
                  <li style={topicStyles.li}><strong>Today:</strong> Resets at midnight (00:00) and shows activity from midnight to the current time</li>
                  <li style={topicStyles.li}><strong>This Week:</strong> Starts from Monday 00:00 and includes the current week up to now</li>
                  <li style={topicStyles.li}><strong>This Month:</strong> Begins on the 1st of the current month and shows month-to-date activity</li>
                  <li style={topicStyles.li}><strong>Timezone:</strong> All calculations use your local browser timezone</li>
                </ul>
              </div>
              
              <div style={{ marginBottom: '25px' }}>
                <h3 style={{ fontSize: '1.1rem', color: '#007B7F', marginBottom: '10px' }}>🔄 Manual Refresh Options</h3>
                <p style={topicStyles.p}>While analytics update automatically, you can also manually refresh your data:</p>
                <ul style={topicStyles.ul}>
                  <li style={topicStyles.li}><strong>Page Refresh:</strong> Simply refresh your browser or navigate away and back to the Explore page</li>
                  <li style={topicStyles.li}><strong>Instant Updates:</strong> New customer interactions appear immediately without needing to refresh</li>
                  <li style={topicStyles.li}><strong>Browser Cache:</strong> Your browser may cache some data - a hard refresh (Ctrl+F5) ensures latest data</li>
                </ul>
              </div>
              
              <h2 style={topicStyles.h2}>Understanding Analytics Cards Layout</h2>
              <p style={topicStyles.p}>Your analytics are displayed in a responsive card layout that adapts to your device:</p>
              
              <div style={{ padding: '15px', backgroundColor: '#f0f7f7', borderRadius: '8px', marginBottom: '20px' }}>
                <h4 style={{ fontSize: '1.05rem', marginBottom: '10px', color: '#007B7F' }}>Desktop & Tablet View</h4>
                <ul style={topicStyles.ul}>
                  <li style={topicStyles.li}>Analytics cards are displayed side-by-side for easy comparison</li>
                  <li style={topicStyles.li}>Each time period (Today, This Week, This Month) has its own dedicated section</li>
                  <li style={topicStyles.li}>All metrics are visible at once for comprehensive analysis</li>
                  <li style={topicStyles.li}>PDF download buttons are prominently placed next to each analytics card</li>
                  <li style={topicStyles.li}>Pie charts display alongside the numerical data for visual analysis</li>
                </ul>
              </div>
              
              <div style={{ padding: '15px', backgroundColor: '#f0f7f7', borderRadius: '8px', marginBottom: '20px' }}>
                <h4 style={{ fontSize: '1.05rem', marginBottom: '10px', color: '#007B7F' }}>Mobile View</h4>
                <ul style={topicStyles.ul}>
                  <li style={topicStyles.li}>Analytics cards stack vertically for optimal mobile viewing</li>
                  <li style={topicStyles.li}>Each card maintains full readability on smaller screens</li>
                  <li style={topicStyles.li}>Swipe or scroll to view all your analytics data</li>
                  <li style={topicStyles.li}>PDF download buttons remain easily accessible on mobile devices</li>
                  <li style={topicStyles.li}>Pie charts are optimized for touch interaction and mobile viewing</li>
                </ul>
              </div>
              
              <h2 style={topicStyles.h2}>Troubleshooting Analytics</h2>
              
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '1.05rem', marginBottom: '8px', color: '#333' }}>📊 No Data Showing</h4>
                <ul style={topicStyles.ul}>
                  <li style={topicStyles.li}>This is normal for new stores - data will appear as customers interact with your store</li>
                  <li style={topicStyles.li}>Make sure your store is live and has products listed</li>
                  <li style={topicStyles.li}>Analytics update in real-time, so new activity should appear immediately</li>
                </ul>
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '1.05rem', marginBottom: '8px', color: '#333' }}>📊 Data Seems Inaccurate</h4>
                <ul style={topicStyles.ul}>
                  <li style={topicStyles.li}>Analytics data is pulled directly from your store's activity log</li>
                  <li style={topicStyles.li}>Each metric is counted only once per customer session</li>
                  <li style={topicStyles.li}>If you notice discrepancies, contact support with specific details</li>
                </ul>
              </div>
              
              <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
                <h3 style={{ fontSize: '1.15rem', marginBottom: '10px', color: '#333' }}>Analytics Best Practices</h3>
                <ul style={topicStyles.ul}>
                  <li style={topicStyles.li}><strong>Check regularly:</strong> Review your analytics daily to stay on top of trends</li>
                  <li style={topicStyles.li}><strong>Compare periods:</strong> Look at today vs. last week, this week vs. last month</li>
                  <li style={topicStyles.li}><strong>Use visual data:</strong> Study the pie charts to understand the proportion of different customer interactions</li>
                  <li style={topicStyles.li}><strong>Download reports:</strong> Save monthly PDF reports for business records and tax purposes</li>
                  <li style={topicStyles.li}><strong>Track seasonal trends:</strong> Use historical PDF reports to identify busy periods and plan accordingly</li>
                  <li style={topicStyles.li}><strong>Act on insights:</strong> Use the data to make informed business decisions</li>
                  <li style={topicStyles.li}><strong>Monitor conversion rates:</strong> Track the percentage of views that become orders using the pie chart ratios</li>
                  <li style={topicStyles.li}><strong>Share with stakeholders:</strong> Use PDF reports to share performance data with business partners or investors</li>
                  <li style={topicStyles.li}><strong>Focus on conversion:</strong> Work to improve the journey from views to completed orders</li>
                  <li style={topicStyles.li}><strong>Real-time monitoring:</strong> Check analytics after making changes to see immediate impact</li>
                </ul>
              </div>
              
              <div style={{ marginTop: '30px' }}>
                <p style={{ fontStyle: 'italic', color: '#666' }}>Need help understanding your analytics? Our support team can provide personalized guidance:</p>
                <button 
                  onClick={() => isLoggedIn ? setHelpTopic('contact-support') : handleUnauthenticatedSupport()}
                  style={{
                    backgroundColor: '#007B7F',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '8px 15px',
                    cursor: 'pointer',
                    fontSize: '0.95rem'
                  }}
                >
                  Contact Support
                </button>
              </div>
            </div>
          )}

          {/* Explore Page Guide Content */}
          {helpTopic === 'explore-page-guide' && (
            <div>
              <h1 style={topicStyles.h1}>Using the Explore Page</h1>
              
              <div style={topicStyles.infoBox}>
                <p><strong>The Explore page is your gateway</strong> to discovering local shops and businesses around you. Learn how to use its features effectively to find exactly what you're looking for.</p>
              </div>
              
              <h2 style={topicStyles.h2}>Navigating the Explore Page</h2>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>1</div>
                <div style={topicStyles.steps.content}>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Location Detection</h3>
                  <p>When you first visit the Explore page, Lokal will request permission to access your location. This helps us show you shops and services that are closest to you.</p>
                  <ul style={topicStyles.ul}>
                    <li>Allow location access for the best experience</li>
                    <li>Your location is only used to calculate distances to shops</li>
                    <li>If you deny location access, you can still enter your location manually</li>
                  </ul>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>2</div>
                <div style={topicStyles.steps.content}>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Filtering and Searching</h3>
                  <p>Use the search and filter options to narrow down results:</p>
                  <ul style={topicStyles.ul}>
                    <li><strong>Search bar:</strong> Type keywords related to products, store names, or services</li>
                    <li><strong>Categories:</strong> Filter shops by categories like Foods & Goods, Meat & Poultry, etc.</li>
                    <li><strong>Filter options:</strong> Sort by "Open Now" to see currently operating shops</li>
                    <li><strong>Sort options:</strong> Sort by distance, newest, highest rated, etc.</li>
                  </ul>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>3</div>
                <div style={topicStyles.steps.content}>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Setting Search Radius</h3>
                  <p>Adjust how far you're willing to travel:</p>
                  <ul style={topicStyles.ul}>
                    <li>Use the radius slider to set your preferred search distance (up to 30km)</li>
                    <li>The map will update to show only stores within your selected radius</li>
                    <li>Smaller radius means faster loading times and more relevant results</li>
                  </ul>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>4</div>
                <div style={topicStyles.steps.content}>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Understanding Store Cards</h3>
                  <p>Each store card displays important information:</p>
                  <ul style={topicStyles.ul}>
                    <li>Store name and category</li>
                    <li>Distance from your current location</li>
                    <li>Opening hours and "Open Now" indicator</li>
                    <li>Rating based on customer reviews</li>
                    <li>Featured products or special offers</li>
                  </ul>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>5</div>
                <div style={topicStyles.steps.content}>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Buyer vs. Seller Explore Pages</h3>
                  <p>Lokal offers two different versions of the Explore page depending on your account type:</p>
                  <ul style={topicStyles.ul}>
                    <li><strong>Buyer Explore Page:</strong> For finding and discovering stores to shop from</li>
                    <li><strong>Seller Explore Page:</strong> For sellers to monitor competitor presence and market coverage</li>
                  </ul>
                  
                  <h4 style={{ fontSize: '1.1rem', marginTop: '15px', marginBottom: '8px' }}>For Sellers:</h4>
                  <ul style={topicStyles.ul}>
                    <li>View how your store appears to potential customers in the Explore page</li>
                    <li>See if your store displays as "Open" or "Closed" based on your set hours</li>
                    <li>Boost your store's visibility with promotional options by paying for boost periods</li>
                    <li>Monitor which stores are currently boosted in your area</li>
                    <li>Access the boost feature directly from your store management area rather than the Explore page</li>
                  </ul>
                  
                  <p style={{ marginTop: '10px' }}>When logged in as a seller, you can see exactly how your business appears to customers, including your store card display, ratings, and open status. The boost feature allows you to make your store more prominent in search results for a set duration.</p>
                </div>
              </div>

              <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
                <h3 style={{ fontSize: '1.15rem', marginBottom: '10px', color: '#333' }}>Tips for Better Results</h3>
                <ul style={topicStyles.ul}>
                  <li><strong>Click the 📍 pin icon</strong> at the top of the page anytime to instantly refresh your location</li>
                  <li>Allow the app to refresh your location periodically for the most accurate results</li>
                  <li>Try different search terms if you don't find what you're looking for initially</li>
                  <li>Check "Recently Viewed" stores for quick access to shops you've visited before</li>
                  <li>Use the city selector to browse shops in different areas if you're planning to travel</li>
                </ul>
              </div>
              
              <div style={{ marginTop: '30px' }}>
                <p style={{ fontStyle: 'italic', color: '#666' }}>Having trouble with the Explore page? See our Location Troubleshooting guide:</p>
                <button 
                  onClick={(e) => { e.preventDefault(); setHelpTopic('location-troubleshooting'); }}
                  style={{
                    backgroundColor: '#007B7F',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '8px 15px',
                    cursor: 'pointer',
                    fontSize: '0.95rem'
                  }}
                >
                  Location Troubleshooting
                </button>
              </div>
            </div>
          )}

          {/* Location Troubleshooting Content */}
          {helpTopic === 'location-troubleshooting' && (
            <div>
              <h1 style={topicStyles.h1}>Location Troubleshooting</h1>
              
              <div style={topicStyles.infoBox}>
                <p><strong>Having trouble with location detection?</strong> Follow these steps to ensure you can see the stores near you.</p>
              </div>
              
              <h2 style={topicStyles.h2}>Common Location Issues and Solutions</h2>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>1</div>
                <div style={topicStyles.steps.content}>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Location Permission Denied</h3>
                  <p>If you denied location access or if your browser blocked it:</p>
                  <ul style={topicStyles.ul}>
                    <li>Click the <strong>📍 pin icon</strong> at the top of the Explore page to request location access again</li>
                    <li>When the permission prompt appears, select "Allow" to grant location access</li>
                    <li>If you don't see the prompt, check your browser settings:</li>
                  </ul>
                  <div style={{ marginLeft: '20px' }}>
                    <p><strong>Chrome:</strong> Click the lock icon in the address bar {'->'} Site Settings {'->'} Location {'->'} Allow</p>
                    <p><strong>Safari:</strong> Settings {'->'} Safari {'->'} Privacy & Security {'->'} Location Services {'->'} Enable</p>
                    <p><strong>Firefox:</strong> Click the lock icon {'->'} Permissions {'->'} Access Your Location {'->'} Allow</p>
                  </div>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>2</div>
                <div style={topicStyles.steps.content}>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Manual Location Entry</h3>
                  <p>If automatic location detection isn't working:</p>
                  <ul style={topicStyles.ul}>
                    <li>Click "Enter location manually" on the Explore page</li>
                    <li>Type your city, area, or postal code</li>
                    <li>Select from the suggested options that appear</li>
                    <li>Your search results will update based on the entered location</li>
                  </ul>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>3</div>
                <div style={topicStyles.steps.content}>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Inaccurate Location</h3>
                  <p>If Lokal shows an incorrect location:</p>
                  <ul style={topicStyles.ul}>
                    <li>First, try the <strong>📍 pin icon</strong> to refresh your location (see detailed guide in step 4 below)</li>
                    <li>If your location is still incorrect, try these solutions:</li>
                    <ul style={{ marginTop: '8px', marginLeft: '15px' }}>
                      <li>Make sure your device's GPS is enabled in your device settings</li>
                      <li>Grant precise location permissions (not just approximate) if your device offers this option</li>
                      <li>Try switching from Wi-Fi to mobile data or vice versa (different networks may provide different location accuracy)</li>
                      <li>Move to a location with better GPS signal (away from tall buildings or underground areas)</li>
                      <li>Try clearing your browser cache and cookies</li>
                      <li>Restart your browser or device</li>
                    </ul>
                    <li>If automatic location detection continues to fail, use the manual location entry option as described in step 2</li>
                  </ul>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>4</div>
                <div style={topicStyles.steps.content}>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Using the Pin Icon to Refresh Location</h3>
                  <p>The pin icon is your most important tool for location updates:</p>
                  <div style={{ padding: '15px', backgroundColor: '#e6f7f5', borderRadius: '8px', marginBottom: '15px', border: '1px solid #a8e6e0' }}>
                    <h4 style={{ fontSize: '1.05rem', marginBottom: '10px', color: '#007B7F' }}>How to Use the Pin Icon</h4>
                    <ul style={topicStyles.ul}>
                      <li>Look for the <strong>📍 pin icon</strong> at the top of the Explore page next to your city name</li>
                      <li>Click on it to instantly trigger a new location detection</li>
                      <li>The icon will change to a spinning <strong>🔄</strong> symbol while detecting your location</li>
                      <li>Your city name will temporarily change to "Detecting location..." during this process</li>
                      <li>When complete, the map and store listings will update based on your refreshed location</li>
                    </ul>
                  </div>
                  
                  <h4 style={{ fontSize: '1.05rem', marginBottom: '10px', color: '#007B7F' }}>When to Use the Pin Icon</h4>
                  <ul style={topicStyles.ul}>
                    <li><strong>When you first open the Explore page</strong> and want to ensure location accuracy</li>
                    <li><strong>After changing your physical location</strong> (e.g., traveling to a different area)</li>
                    <li><strong>When store distances seem incorrect</strong> or don't match your actual location</li>
                    <li><strong>When you see the message "Location unavailable"</strong> but want to try detection again</li>
                    <li><strong>When switching between networks</strong> (e.g., from mobile data to WiFi)</li>
                  </ul>
                  
                  <h4 style={{ fontSize: '1.05rem', marginBottom: '10px', marginTop: '15px', color: '#007B7F' }}>Troubleshooting Pin Icon Issues</h4>
                  <ul style={topicStyles.ul}>
                    <li>If clicking the pin icon doesn't update your location after several attempts, check your browser's location permissions</li>
                    <li>Some browsers may require you to interact with the page first before allowing location access</li>
                    <li>On mobile devices, ensure location services are enabled in your device settings</li>
                    <li>If the pin icon stays in the spinning state for more than 30 seconds, try refreshing the page</li>
                  </ul>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>5</div>
                <div style={topicStyles.steps.content}>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>No Stores Showing</h3>
                  <p>If you don't see any stores after location is detected:</p>
                  <ul style={topicStyles.ul}>
                    <li>Try increasing your search radius using the slider</li>
                    <li>Remove any category or filter selections that might be limiting results</li>
                    <li>Check if your city is supported by Lokal (we're constantly expanding)</li>
                    <li>Try searching for specific product types or store names</li>
                  </ul>
                </div>
              </div>
              
              <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
                <h3 style={{ fontSize: '1.15rem', marginBottom: '10px', color: '#333' }}>Location Privacy</h3>
                <p>Lokal values your privacy:</p>
                <ul style={topicStyles.ul}>
                  <li>Your location is only used to show nearby stores and calculate distances</li>
                  <li>We never track your movements or store location history without your consent</li>
                  <li>You can use the manual location option if you prefer not to share your exact location</li>
                </ul>
              </div>
              
              <div style={{ marginTop: '30px' }}>
                <p style={{ fontStyle: 'italic', color: '#666' }}>Still having location issues? Our support team can help:</p>
                <button 
                  onClick={() => isLoggedIn ? setHelpTopic('contact-support') : handleUnauthenticatedSupport()}
                  style={{
                    backgroundColor: '#007B7F',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '8px 15px',
                    cursor: 'pointer',
                    fontSize: '0.95rem'
                  }}
                >
                  Contact Support
                </button>
              </div>
            </div>
          )}

          {/* Report Bugs Content */}
          {helpTopic === 'report-bugs' && (
            <div>
              <h1 style={topicStyles.h1}>Reporting Bugs and Technical Issues</h1>
              
              <div style={topicStyles.infoBox}>
                <p><strong>Found something not working correctly?</strong> Help us improve Lokal by reporting bugs and technical issues.</p>
              </div>
              
              <h2 style={topicStyles.h2}>How to Report a Bug</h2>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>1</div>
                <div style={topicStyles.steps.content}>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Gather Information</h3>
                  <p>Before reporting, collect these details to help us solve the issue faster:</p>
                  <ul style={topicStyles.ul}>
                    <li>What were you trying to do when the bug occurred?</li>
                    <li>What happened instead of the expected behavior?</li>
                    <li>Which page or feature were you using?</li>
                    <li>Device information (phone/tablet/desktop, browser type and version)</li>
                    <li>Screenshots showing the issue (if possible)</li>
                    <li>Time and date when the issue occurred</li>
                  </ul>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>2</div>
                <div style={topicStyles.steps.content}>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Try Basic Troubleshooting</h3>
                  <p>Sometimes simple steps can resolve the issue:</p>
                  <ul style={topicStyles.ul}>
                    <li>Refresh the page</li>
                    <li>Clear your browser cache and cookies</li>
                    <li>Try a different browser or device if possible</li>
                    <li>Check your internet connection</li>
                    <li>Log out and log back in</li>
                  </ul>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>3</div>
                <div style={topicStyles.steps.content}>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Submit a Bug Report</h3>
                  <p>Contact our support team with your bug report:</p>
                  <ul style={topicStyles.ul}>
                    <li>Use the "Contact Support" button below</li>
                    <li>Select "Technical Issues" as the subject category</li>
                    <li>Include all the information you gathered in step 1</li>
                    <li>Be as specific and detailed as possible</li>
                  </ul>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>4</div>
                <div style={topicStyles.steps.content}>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Follow Up</h3>
                  <p>After submitting your report:</p>
                  <ul style={topicStyles.ul}>
                    <li>You'll receive a confirmation email with a case number</li>
                    <li>Our technical team will investigate the issue</li>
                    <li>We may contact you for additional information if needed</li>
                    <li>You'll be notified when the bug is fixed</li>
                  </ul>
                </div>
              </div>
              
              <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
                <h3 style={{ fontSize: '1.15rem', marginBottom: '10px', color: '#333' }}>Common Issues and Known Bugs</h3>
                <p>Check if your issue is already known:</p>
                <ul style={topicStyles.ul}>
                  <li><strong>Location detection:</strong> Sometimes requires multiple attempts on certain devices. Use our troubleshooting guide if needed.</li>
                  <li><strong>Payment processing:</strong> Occasional delays in transaction confirmation. Always check your bank statement before attempting multiple payments.</li>
                  <li><strong>Image loading:</strong> May be slow on poor connections. Try switching to mobile data if on Wi-Fi or vice versa.</li>
                  <li><strong>Notifications:</strong> Push notifications might be delayed on some devices. Check the app regularly for updates.</li>
                </ul>
              </div>
              
              <div style={{ marginTop: '30px' }}>
                <p style={{ fontStyle: 'italic', color: '#666' }}>Ready to report a bug? Our technical team is here to help:</p>
                <button 
                  onClick={() => isLoggedIn ? setHelpTopic('contact-support') : handleUnauthenticatedSupport()}
                  style={{
                    backgroundColor: '#007B7F',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '8px 15px',
                    cursor: 'pointer',
                    fontSize: '0.95rem'
                  }}
                >
                  Contact Support
                </button>
              </div>
            </div>
          )}

          {/* Receipts Page Guide Content */}
          {helpTopic === 'receipts-guide' && (
            <div>
              <h1 style={topicStyles.h1}>Using the Receipts Page</h1>
              
              <div style={topicStyles.infoBox}>
                <p><strong>Track Your Purchases & Refunds:</strong> The Receipts page provides a comprehensive view of your order history and refund transactions. Learn how to access, filter, and understand your transaction records.</p>
              </div>
              
              <h2 style={topicStyles.h2}>What Are Receipts?</h2>
              
              <div style={{ padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '8px', marginBottom: '20px' }}>
                <p style={{ margin: 0 }}><strong>Receipts</strong> are digital records of your transactions on Lokal. They serve as proof of purchase or refund and contain important details about your interactions with sellers.</p>
                
                <div style={{ marginTop: '15px' }}>
                  <h4 style={{ fontSize: '1rem', marginBottom: '8px', color: '#007B7F' }}>Key Features of Lokal's Receipt System:</h4>
                  <ul style={{ paddingLeft: '20px', marginBottom: 0 }}>
                    <li><strong>Centralized Storage:</strong> All receipts are stored in a dedicated database collection, serving as a single source of truth</li>
                    <li><strong>Complete Transaction History:</strong> Captures orders, refunds, and other financial interactions</li>
                    <li><strong>Automatic Generation:</strong> Receipts are created instantly whenever you complete a transaction</li>
                    <li><strong>Secure Record-keeping:</strong> Provides a reliable audit trail of all your purchases and refunds</li>
                    <li><strong>Unified Access:</strong> All your receipts are available in one convenient location, regardless of where the transaction originated</li>
                  </ul>
                </div>
              </div>

              <h2 style={topicStyles.h2}>Accessing Your Receipts</h2>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>1</div>
                <div style={topicStyles.steps.content}>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Navigate to Receipts</h3>
                  <p>Access your receipts by clicking on the "Receipts" option in your account menu or navigation bar. This page contains all your orders and refunds in one convenient location.</p>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>2</div>
                <div style={topicStyles.steps.content}>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Understanding Receipt Types</h3>
                  <p>The Receipts page displays two main types of transaction records:</p>
                  <ul style={topicStyles.ul}>
                    <li><strong>Order Receipts:</strong> Confirmations of purchases you've made, marked with a 🧾 icon</li>
                    <li><strong>Refund Receipts:</strong> Records of refunds you've received, marked with a 💸 icon</li>
                  </ul>
                  <p>Some receipts may also display a ♻️ Regenerated tag, indicating that the seller has regenerated the receipt after the original transaction.</p>
                  <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#e0f7fa', borderRadius: '6px' }}>
                    <p><strong>Important:</strong> The Receipts page shows <em>all</em> your transactions from our central receipts database, including orders placed through Messages, the Explore page, or any other part of the app. Every purchase and refund associated with your account will appear here, regardless of how the order was originally placed.</p>
                    <p style={{ marginTop: '8px' }}><strong>Note:</strong> Lokal uses a dedicated receipts collection as a single source of truth for all your transaction records. All receipts are automatically stored in this centralized database for your convenience, eliminating the need to search through different parts of the app for your purchase history.</p>
                    <p style={{ marginTop: '8px' }}><strong>Tip:</strong> If you don't see a recently generated receipt or refund, click the "Refresh Receipts" button at the top of the page to ensure you're viewing the most up-to-date information from our centralized receipt system.</p>
                  </div>
                </div>
              </div>
              
              <h2 style={topicStyles.h2}>Filtering Your Receipts</h2>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>3</div>
                <div style={topicStyles.steps.content}>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Filter by Receipt Type</h3>
                  <p>At the top of the Receipts page, you'll find three filter buttons to organize your centralized receipt collection:</p>
                  <ul style={topicStyles.ul}>
                    <li><strong>All:</strong> Shows all receipts including both orders and refunds from the centralized database</li>
                    <li><strong>Orders:</strong> Displays only order receipts (purchases you've made)</li>
                    <li><strong>Refunds:</strong> Shows only refund receipts (money returned to you)</li>
                  </ul>
                  <p>Click on any of these buttons to filter your receipts accordingly. Thanks to our centralized receipt system, the Receipts page shows all your transactions in one place - whether they originated from the Messages page, Explore page, or other parts of the app. This unified approach ensures a complete view of your purchase history.</p>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>4</div>
                <div style={topicStyles.steps.content}>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Search Your Receipts</h3>
                  <p>Use the search box to find specific receipts by:</p>
                  <ul style={topicStyles.ul}>
                    <li>Store name (e.g., "Green Market")</li>
                    <li>Order ID (e.g., the last few digits of an order number)</li>
                    <li>Refund reason (for refund receipts)</li>
                  </ul>
                  <p>Simply type your search term in the box and the receipts will be filtered automatically.</p>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>5</div>
                <div style={topicStyles.steps.content}>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Sort Your Receipts</h3>
                  <p>You can organize your receipts chronologically using the "Sort By" dropdown:</p>
                  <ul style={topicStyles.ul}>
                    <li><strong>Newest First:</strong> Displays your most recent transactions at the top</li>
                    <li><strong>Oldest First:</strong> Shows your earliest transactions at the top</li>
                  </ul>
                </div>
              </div>
              
              <h2 style={topicStyles.h2}>Viewing Receipt Details</h2>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>6</div>
                <div style={topicStyles.steps.content}>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Open Receipt Details</h3>
                  <p>To view the complete details of any receipt:</p>
                  <ol style={{ paddingLeft: '20px' }}>
                    <li>Locate the receipt you want to view in the list</li>
                    <li>Click anywhere on the receipt card</li>
                    <li>A detailed receipt modal will open with comprehensive information</li>
                  </ol>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>7</div>
                <div style={topicStyles.steps.content}>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Understanding the Receipt Detail View</h3>
                  <p>The detailed receipt view shows:</p>
                  <ul style={topicStyles.ul}>
                    <li><strong>Store Information:</strong> Name of the store where you made the purchase</li>
                    <li><strong>Order ID:</strong> Unique identifier for your transaction</li>
                    <li><strong>Date & Time:</strong> When the transaction occurred</li>
                    <li><strong>Total Amount:</strong> The transaction amount with currency symbol</li>
                    <li><strong>Item Details:</strong> List of purchased items with quantities and prices</li>
                    <li><strong>Payment Information:</strong> Payment method used and delivery details</li>
                    <li><strong>Refund Reason:</strong> For refund receipts, the reason for the refund</li>
                  </ul>
                </div>
              </div>
              
              <h2 style={topicStyles.h2}>Managing Your Receipt History</h2>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>8</div>
                <div style={topicStyles.steps.content}>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Using Pagination</h3>
                  <p>If you have many receipts, they'll be organized into pages:</p>
                  <ul style={topicStyles.ul}>
                    <li>Each page shows up to 10 receipts</li>
                    <li>Use the "Previous" and "Next" buttons at the bottom to navigate between pages</li>
                    <li>The current page indicator shows which page you're viewing (e.g., "Page 1 of 3")</li>
                  </ul>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>9</div>
                <div style={topicStyles.steps.content}>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>Refreshing Your Receipts List</h3>
                  <p>All your receipts are stored in Lokal's dedicated receipts collection, which serves as a single source of truth for all transaction records. This centralized approach ensures you can easily access your complete purchase history in one place.</p>
                  <div style={{ padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '6px', marginBottom: '12px' }}>
                    <p style={{ margin: 0, fontWeight: 500 }}>How Our Centralized Receipt System Works:</p>
                    <ul style={{ marginTop: '8px', marginBottom: 0, paddingLeft: '20px' }}>
                      <li>Every transaction (order, refund, etc.) automatically creates a receipt in our dedicated receipts collection</li>
                      <li>This collection serves as the single source of truth for all receipt data</li>
                      <li>The Receipts page queries this collection directly, ensuring consistent and reliable display</li>
                      <li>All receipt types appear in one unified view, regardless of where they originated</li>
                    </ul>
                  </div>
                  <p>If you've recently made a purchase or received a refund and don't see it in your receipts:</p>
                  <ol style={topicStyles.ul}>
                    <li>Click the <strong>"Refresh Receipts"</strong> button at the top of the page to load the latest transactions from the centralized receipts collection</li>
                    <li>This ensures all receipts - including newly generated ones - will appear in your list</li>
                    <li>The system automatically updates to show regenerated receipts with the ♻️ tag</li>
                    <li>All refund receipts will be displayed, including those from the Messages page</li>
                    <li>Your receipts are securely stored and easily accessible through this streamlined system</li>
                  </ol>
                </div>
              </div>
              
              <div style={topicStyles.steps.container}>
                <div style={topicStyles.steps.counter}>10</div>
                <div style={topicStyles.steps.content}>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '8px' }}>What To Do When No Receipts Are Found</h3>
                  <p>If no receipts appear in your list, it could be due to:</p>
                  <ul style={topicStyles.ul}>
                    <li>You haven't made any purchases yet</li>
                    <li>Your search term doesn't match any receipts</li>
                    <li>You've filtered for a specific receipt type that you don't have</li>
                  </ul>
                  <p>Try clearing your search, switching to "All" in the filter type, or clicking the "Refresh Receipts" button to ensure you're seeing all available receipts.</p>
                </div>
              </div>
              
              <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
                <h3 style={{ fontSize: '1.15rem', marginBottom: '10px', color: '#333' }}>Tips for Using the Receipts Page</h3>
                <ul style={topicStyles.ul}>
                  <li><strong>Keep Track of Expenses:</strong> Regularly check your receipts to monitor your spending on Lokal</li>
                  <li><strong>Refresh for Latest Data:</strong> Use the "Refresh Receipts" button to ensure all recent transactions are visible</li>
                  <li><strong>Centralized Receipt System:</strong> All your receipts are automatically stored in our secure database for easy access</li>
                  <li><strong>Verify Refunds:</strong> If you've requested a refund, check the Receipts page for confirmation</li>
                  <li><strong>Regenerated Receipts:</strong> Look for the ♻️ tag that indicates a seller has updated or regenerated a receipt</li>
                  <li><strong>Save for Records:</strong> Use the detailed receipt view for record-keeping or expense tracking</li>
                  <li><strong>Check Recent Orders:</strong> Filter by "Newest First" to quickly find your most recent transactions</li>
                </ul>
              </div>
              
              <div style={{ marginTop: '30px' }}>
                <p style={{ fontStyle: 'italic', color: '#666' }}>Having issues with your receipts? Learn how to request a refund:</p>
                <button 
                  onClick={(e) => { e.preventDefault(); setHelpTopic('refund-requests'); }}
                  style={{
                    backgroundColor: '#007B7F',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '8px 15px',
                    cursor: 'pointer',
                    fontSize: '0.95rem'
                  }}
                >
                  Refund Requests
                </button>
              </div>
            </div>
          )}
          
          {/* Other help topics will be added here */}
        </div>
      </div>
    );
  }

  // Help Center main view
  return (
    <div style={{ background: '#F0F2F5', minHeight: '100vh' }}>
      <Navbar />
      <div style={{ maxWidth: 800, margin: '2rem auto', marginTop: '2rem', background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px #B8B8B8', padding: '2rem' }}>
        <h2 style={{ fontWeight: 700, fontSize: '1.8rem', marginBottom: 24, color: '#007B7F' }}>Help Center</h2>
        
        <p style={{ marginBottom: 20, fontSize: '1.1rem' }}>
          Welcome to the Lokal Help Center! Find answers to common questions and learn how to make the most of your Lokal experience.
        </p>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px', marginBottom: '30px' }}>
          
          {/* For Store Owners */}
          <div style={{ padding: '20px', border: '1px solid #e0e0e0', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
              <div style={{ backgroundColor: '#007B7F', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginRight: '15px' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="white" viewBox="0 0 16 16">
                  <path d="M0 2.5A1.5 1.5 0 0 1 1.5 1h11A1.5 1.5 0 0 1 14 2.5v10.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 0 13V2.5zM3 3.5a.5.5 0 1 0-1 0 .5.5 0 0 0 1 0zm1.5.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1zm1 0a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1z"/>
                  <path d="M2 5.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1-.5-.5v-1zm0 3a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1a.5.5 0 0 1-.5-.5zm3 0a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 0 1h-1a.5.5 0 0 1-.5-.5z"/>
                </svg>
              </div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>Setting Up Your Store</h3>
            </div>
            <p style={{ margin: '0 0 15px 0', color: '#555' }}>Learn how to create and configure your store, add products, and start selling on Lokal.</p>
            <ul style={{ paddingLeft: '20px', marginBottom: '0' }}>
              <li style={{ marginBottom: '8px' }}>
                <a 
                  href="#" 
                  onClick={(e) => { e.preventDefault(); setHelpTopic('store-creation'); }} 
                  style={{ color: '#007B7F', textDecoration: 'none', fontWeight: 500 }}
                >
                  Store creation guide
                </a>
              </li>
              <li style={{ marginBottom: '8px' }}>
                <a 
                  href="#" 
                  onClick={(e) => { e.preventDefault(); setHelpTopic('adding-products'); }} 
                  style={{ color: '#007B7F', textDecoration: 'none', fontWeight: 500 }}
                >
                  Adding products to your inventory
                </a>
              </li>
              <li style={{ marginBottom: '8px' }}>
                <a 
                  href="#" 
                  onClick={(e) => { e.preventDefault(); setHelpTopic('payment-methods'); }} 
                  style={{ color: '#007B7F', textDecoration: 'none', fontWeight: 500 }}
                >
                  Setting up payment methods
                </a>
              </li>
              <li style={{ marginBottom: '8px' }}>
                <a 
                  href="#" 
                  onClick={(e) => { e.preventDefault(); setHelpTopic('store-analytics'); }} 
                  style={{ color: '#007B7F', textDecoration: 'none', fontWeight: 500 }}
                >
                  Understanding store analytics
                </a>
              </li>
            </ul>
          </div>
          
          {/* For Payment Issues */}
          <div style={{ padding: '20px', border: '1px solid #e0e0e0', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
              <div style={{ backgroundColor: '#007B7F', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginRight: '15px' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="white" viewBox="0 0 16 16">
                  <path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4zm2-1a1 1 0 0 0-1 1v1h14V4a1 1 0 0 0-1-1H2zm13 4H1v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7z"/>
                  <path d="M2 10a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-1z"/>
                </svg>
              </div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>Payment Issues</h3>
            </div>
            <p style={{ margin: '0 0 15px 0', color: '#555' }}>Solutions for common payment problems and how to resolve transaction issues.</p>
            <ul style={{ paddingLeft: '20px', marginBottom: '0' }}>
              <li style={{ marginBottom: '8px' }}>
                <a 
                  href="#" 
                  onClick={(e) => { e.preventDefault(); setHelpTopic('failed-transactions'); }} 
                  style={{ color: '#007B7F', textDecoration: 'none', fontWeight: 500 }}
                >
                  Failed transactions
                </a>
              </li>
              <li style={{ marginBottom: '8px' }}>
                <a 
                  href="#" 
                  onClick={(e) => { e.preventDefault(); setHelpTopic('refund-requests'); }} 
                  style={{ color: '#007B7F', textDecoration: 'none', fontWeight: 500 }}
                >
                  Refund requests
                </a>
              </li>
              <li style={{ marginBottom: '8px' }}>
                <a 
                  href="#" 
                  onClick={(e) => { e.preventDefault(); setHelpTopic('bank-details'); }} 
                  style={{ color: '#007B7F', textDecoration: 'none', fontWeight: 500 }}
                >
                  Setting up bank details
                </a>
              </li>
            </ul>
          </div>
          
          {/* For Account Issues */}
          <div style={{ padding: '20px', border: '1px solid #e0e0e0', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
              <div style={{ backgroundColor: '#007B7F', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginRight: '15px' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="white" viewBox="0 0 16 16">
                  <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z"/>
                </svg>
              </div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>Account Management</h3>
            </div>
            <p style={{ margin: '0 0 15px 0', color: '#555' }}>Help with account settings, profile updates, and security concerns.</p>
            <ul style={{ paddingLeft: '20px', marginBottom: '0' }}>
              <li style={{ marginBottom: '8px' }}>
                <a 
                  href="#" 
                  onClick={(e) => { e.preventDefault(); setHelpTopic('update-profile'); }} 
                  style={{ color: '#007B7F', textDecoration: 'none', fontWeight: 500 }}
                >
                  Updating profile information
                </a>
              </li>
              <li style={{ marginBottom: '8px' }}>
                <a 
                  href="#" 
                  onClick={(e) => { e.preventDefault(); setHelpTopic('password-reset'); }} 
                  style={{ color: '#007B7F', textDecoration: 'none', fontWeight: 500 }}
                >
                  Password reset
                </a>
              </li>
              <li style={{ marginBottom: '8px' }}>
                <a 
                  href="#" 
                  onClick={(e) => { e.preventDefault(); setHelpTopic('account-security'); }} 
                  style={{ color: '#007B7F', textDecoration: 'none', fontWeight: 500 }}
                >
                  Account security
                </a>
              </li>
            </ul>
          </div>
          
          {/* For Explore Page Guide */}
          <div style={{ padding: '20px', border: '1px solid #e0e0e0', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
              <div style={{ backgroundColor: '#007B7F', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginRight: '15px' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="white" viewBox="0 0 16 16">
                  <path d="M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10zm0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/>
                </svg>
              </div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>Using the Explore Page</h3>
            </div>
            <p style={{ margin: '0 0 15px 0', color: '#555' }}>Learn how to use the Explore page to find stores near you, troubleshoot location issues, and get the most out of your shopping experience.</p>
            <ul style={{ paddingLeft: '20px', marginBottom: '0' }}>
              <li style={{ marginBottom: '8px' }}>
                <a 
                  href="#" 
                  onClick={(e) => { e.preventDefault(); setHelpTopic('explore-page-guide'); }} 
                  style={{ color: '#007B7F', textDecoration: 'none', fontWeight: 500 }}
                >
                  Using the Explore page
                </a>
              </li>
              <li style={{ marginBottom: '8px' }}>
                <a 
                  href="#" 
                  onClick={(e) => { e.preventDefault(); setHelpTopic('location-troubleshooting'); }} 
                  style={{ color: '#007B7F', textDecoration: 'none', fontWeight: 500 }}
                >
                  Location troubleshooting
                </a>
              </li>
              <li style={{ marginBottom: '8px' }}>
                <a 
                  href="#" 
                  onClick={(e) => { e.preventDefault(); setHelpTopic('report-bugs'); }} 
                  style={{ color: '#007B7F', textDecoration: 'none', fontWeight: 500 }}
                >
                  Reporting bugs
                </a>
              </li>
            </ul>
          </div>
          
          {/* For Buyer Support */}
          <div style={{ padding: '20px', border: '1px solid #e0e0e0', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
              <div style={{ backgroundColor: '#007B7F', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginRight: '15px' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="white" viewBox="0 0 16 16">
                  <path fillRule="evenodd" d="M10.5 3.5a2.5 2.5 0 0 0-5 0V4h5v-.5zm1 0V4H15v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V4h3.5v-.5a3.5 3.5 0 1 1 7 0zm-.646 5.354a.5.5 0 0 0-.708-.708L7.5 10.793 6.354 9.646a.5.5 0 1 0-.708.708l1.5 1.5a.5.5 0 0 0 .708 0l3-3z"/>
                </svg>
              </div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>Shopping Guide</h3>
            </div>
            <p style={{ margin: '0 0 15px 0', color: '#555' }}>Information for buyers on how to browse, purchase, and track orders.</p>
            <ul style={{ paddingLeft: '20px', marginBottom: '0' }}>
              <li style={{ marginBottom: '8px' }}>
                <a 
                  href="#" 
                  onClick={(e) => { e.preventDefault(); setHelpTopic('making-purchase'); }} 
                  style={{ color: '#007B7F', textDecoration: 'none', fontWeight: 500 }}
                >
                  Making a purchase
                </a>
              </li>
              <li style={{ marginBottom: '8px' }}>
                <a 
                  href="#" 
                  onClick={(e) => { e.preventDefault(); setHelpTopic('tracking-order'); }} 
                  style={{ color: '#007B7F', textDecoration: 'none', fontWeight: 500 }}
                >
                  Tracking your order
                </a>
              </li>
              <li style={{ marginBottom: '8px' }}>
                <a 
                  href="#" 
                  onClick={(e) => { e.preventDefault(); setHelpTopic('receipts-guide'); }} 
                  style={{ color: '#007B7F', textDecoration: 'none', fontWeight: 500 }}
                >
                  Using the Receipts page
                </a>
              </li>
              <li style={{ marginBottom: '8px' }}>
                <a 
                  href="#" 
                  onClick={(e) => { e.preventDefault(); setHelpTopic('leaving-reviews'); }} 
                  style={{ color: '#007B7F', textDecoration: 'none', fontWeight: 500 }}
                >
                  Leaving reviews
                </a>
              </li>
            </ul>
          </div>
        </div>
        
        <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#f6f6fa', borderRadius: '8px', textAlign: 'center' }}>
          <h3 style={{ marginTop: 0, color: '#007B7F', fontWeight: 600 }}>Can't find what you're looking for?</h3>
          <p style={{ marginBottom: '20px' }}>Our support team is here to help you with any questions or issues.</p>
          <button 
            onClick={() => isLoggedIn ? setHelpTopic('contact-support') : handleUnauthenticatedSupport()}
            style={{ 
              backgroundColor: '#007B7F', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px', 
              padding: '10px 20px', 
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Contact Support
          </button>
        </div>
      </div>
      
      {/* Modal state kept for backward compatibility, but content moved to the topic-based approach */}

      {/* Authenticated Support Modal */}
      {showSupportModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '24px',
            width: '90%',
            maxWidth: '500px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, color: '#007B7F', fontSize: '1.5rem' }}>Contact Support</h2>
              <button 
                onClick={() => setShowSupportModal(false)}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  cursor: 'pointer', 
                  fontSize: '1.5rem',
                  color: '#666'
                }}
              >
                ×
              </button>
            </div>

            <p style={{ marginBottom: '16px' }}>Please tell us what issue you're experiencing, and our team will get back to you as soon as possible.</p>

            <form>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>Name</label>
                <input
                  type="text"
                  value={supportForm.name}
                  onChange={(e) => setSupportForm({...supportForm, name: e.target.value})}
                  placeholder="Your name"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '1rem'
                  }}
                  required
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>Email Address</label>
                <input
                  type="email"
                  value={supportForm.email}
                  onChange={(e) => setSupportForm({...supportForm, email: e.target.value})}
                  placeholder="your.email@example.com"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '1rem'
                  }}
                  required
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>What's your issue about?</label>
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ 
                    fontSize: '0.9rem', 
                    fontWeight: '500', 
                    color: '#007B7F', 
                    marginBottom: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <span>I am a:</span>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                    <label style={{ 
                      flex: 1, 
                      padding: '10px', 
                      border: '1px solid #ddd', 
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      cursor: 'pointer',
                      backgroundColor: supportForm.userType === 'buyer' ? '#edf7f7' : '#fff'
                    }}>
                      <input 
                        type="radio" 
                        name="userType" 
                        value="buyer"
                        checked={supportForm.userType === 'buyer'}
                        onChange={() => setSupportForm({...supportForm, userType: 'buyer'})}
                        style={{ marginRight: '8px' }}
                      />
                      <span>Buyer</span>
                    </label>
                    <label style={{ 
                      flex: 1, 
                      padding: '10px', 
                      border: '1px solid #ddd', 
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      cursor: 'pointer',
                      backgroundColor: supportForm.userType === 'seller' ? '#edf7f7' : '#fff'
                    }}>
                      <input 
                        type="radio" 
                        name="userType" 
                        value="seller"
                        checked={supportForm.userType === 'seller'}
                        onChange={() => setSupportForm({...supportForm, userType: 'seller'})}
                        style={{ marginRight: '8px' }}
                      />
                      <span>Seller</span>
                    </label>
                  </div>
                </div>
                
                <select
                  value={supportForm.subject}
                  onChange={(e) => setSupportForm({...supportForm, subject: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    backgroundColor: '#fff'
                  }}
                  required
                >
                  <option value="">Select an issue type</option>
                  
                  {supportForm.userType === 'buyer' ? (
                    <>
                      <option value="Order Not Delivered">Order Not Delivered</option>
                      <option value="Payment Issue - Buyer">Payment Issue</option>
                      <option value="Wrong or Damaged Item">Wrong or Damaged Item</option>
                      <option value="Refund Request - Buyer">Refund Request</option>
                      <option value="Seller Communication Issue">Seller Communication Issue</option>
                      <option value="Account Access - Buyer">Account Access</option>
                      <option value="App Technical Issue - Buyer">App Technical Issue</option>
                    </>
                  ) : supportForm.userType === 'seller' ? (
                    <>
                      <option value="Store Setup Help">Store Setup Help</option>
                      <option value="Payment Issue - Seller">Payment Issue</option>
                      <option value="Adding Products Help">Adding Products Help</option>
                      <option value="Order Management Help">Order Management Help</option>
                      <option value="Refund Request - Seller">Refund Request</option>
                      <option value="Account Access - Seller">Account Access</option>
                      <option value="App Technical Issue - Seller">App Technical Issue</option>
                    </>
                  ) : (
                    <>
                      <option value="Technical Issue">Technical Issue</option>
                      <option value="Account Problem">Account Problem</option>
                      <option value="Payment Issue">Payment Issue</option>
                      <option value="Store Setup Help">Store Setup Help</option>
                      <option value="Order Problem">Order Problem</option>
                      <option value="Feature Request">Feature Request</option>
                      <option value="Other">Other</option>
                    </>
                  )}
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>Please describe your issue</label>
                <textarea
                  value={supportForm.message}
                  onChange={(e) => setSupportForm({...supportForm, message: e.target.value})}
                  placeholder="Please provide as much detail as possible about the issue you're experiencing..."
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    minHeight: '120px',
                    resize: 'vertical'
                  }}
                  required
                />
              </div>

              {isLoggedIn && (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={supportForm.includeAccountInfo}
                      onChange={(e) => setSupportForm({...supportForm, includeAccountInfo: e.target.checked})}
                      style={{ marginRight: '8px' }}
                    />
                    <span>Include my account information to help resolve this issue faster</span>
                  </label>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button
                  type="button"
                  onClick={() => setShowSupportModal(false)}
                  style={{
                    padding: '10px 16px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    backgroundColor: '#f5f5f5',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSupportSubmit}
                  disabled={isSubmitting}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#007B7F',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontWeight: 600,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    opacity: isSubmitting ? 0.7 : 1
                  }}
                >
                  {isSubmitting ? 'Sending...' : 'Submit Issue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
  
  // Function to handle support form submission
  async function handleSupportSubmit() {
    // Validate form
    if (!supportForm.name.trim() || !supportForm.email.trim() || 
        !supportForm.subject || !supportForm.message.trim() || !supportForm.userType) {
      alert('Please fill in all required fields, including selecting if you\'re a buyer or seller');
      return;
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(supportForm.email)) {
      alert('Please enter a valid email address');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Create a unique conversation ID for admin messages
      const conversationId = currentUser 
        ? `admin_${currentUser.uid}`
        : `admin_guest_${Date.now()}`;

      // Determine user type for better categorization
      const userType = supportForm.subject.includes('Seller') || 
                      supportForm.subject.includes('Store') || 
                      supportForm.subject.includes('Payment') ? 'seller' : 'buyer';
        
      // Create user data object
      const userData = {
        userName: currentUser?.displayName || supportForm.name,
        userEmail: currentUser?.email || supportForm.email,
        userId: currentUser?.uid || 'guest_user'
      };

      // Organize the support request message
      let supportIssueDetails = `**Support Request: ${supportForm.subject}**\n\n`;
      supportIssueDetails += `${supportForm.message}\n\n`;
      supportIssueDetails += `------------------\n`;
      supportIssueDetails += `Submitted from: Help Center\n`;
      supportIssueDetails += `User type: ${userType}\n`;
      
      if (currentUser && supportForm.includeAccountInfo) {
        supportIssueDetails += `Account: ${currentUser.email} (${currentUser.uid})\n`;
      }
      
      // Create message data object
      const messageData = {
        conversationId: conversationId,
        senderId: currentUser ? currentUser.uid : 'guest_user',
        senderName: supportForm.name,
        senderEmail: supportForm.email,
        receiverId: 'admin',
        receiverName: 'Lokal Admin Support',
        receiverEmail: 'admin@lokal.com',
        message: supportIssueDetails,
        timestamp: serverTimestamp(),
        isRead: false,
        messageType: 'support_request',
        isAdminMessage: true,
        isAdminConversation: true,
        supportData: {
          subject: supportForm.subject,
          userType: userType,
          category: getCategoryFromSubject(supportForm.subject),
          includeAccountInfo: supportForm.includeAccountInfo,
          platform: navigator.userAgent,
          timestamp: new Date().toISOString(),
          userId: currentUser ? currentUser.uid : null,
          userEmail: currentUser ? currentUser.email : supportForm.email
        }
      };
      
      // Add user's account info if included and user is logged in
      if (currentUser && supportForm.includeAccountInfo) {
        messageData.supportData.accountInfo = {
          displayName: currentUser.displayName || null,
          email: currentUser.email,
          uid: currentUser.uid,
          emailVerified: currentUser.emailVerified
        };
      }
      
      // Create initial admin welcome message
      if (currentUser) {
        await addDoc(collection(db, 'messages'), {
          conversationId: conversationId,
          senderId: 'admin',
          senderName: 'Lokal Admin Support',
          senderEmail: 'admin@lokal.com',
          receiverId: currentUser.uid,
          receiverName: userData.userName,
          receiverEmail: userData.userEmail,
          message: 'Hello! Welcome to Lokal Support. I\'m here to help you with any issues you may have.',
          timestamp: serverTimestamp(),
          isRead: false,
          messageType: 'text',
          isAdminMessage: true
        });
      }
      
      // Then save the user's actual support request
      await addDoc(collection(db, 'messages'), messageData);
      
      // Create an immediate response acknowledging receipt
      if (currentUser) {
        const responseMessage = `Thank you for contacting Lokal Support about "${supportForm.subject}". Our team has been notified and will respond to your request shortly. You can continue this conversation in the messages section.`;
        
        await addDoc(collection(db, 'messages'), {
          conversationId: conversationId,
          senderId: 'admin',
          senderName: 'Lokal Admin Support',
          senderEmail: 'admin@lokal.com',
          receiverId: currentUser.uid,
          receiverName: userData.userName,
          receiverEmail: userData.userEmail,
          message: responseMessage,
          timestamp: serverTimestamp(),
          isRead: false,
          messageType: 'support_response',
          isAdminMessage: true,
          isAdminConversation: true,
          supportData: {
            subject: supportForm.subject,
            responseType: 'auto_acknowledgment'
          }
        });
      }
      
      // Show success message and close modal
      alert('Your support request has been submitted successfully. ' + 
            (currentUser ? 'Our team will respond to you through the Messages section of the app.' : 
                          'Our team will contact you via email shortly.'));
      setShowSupportModal(false);
      
      // Reset form
      setSupportForm({
        name: currentUser?.displayName || '',
        email: currentUser?.email || '',
        subject: '',
        message: '',
        userType: '',
        includeAccountInfo: true
      });
      
      // If user is logged in, navigate to messages with this conversation open
      if (currentUser) {
        window.location.href = '/messages?conversation=' + conversationId;
      }
      
    } catch (error) {
      console.error('Error submitting support request:', error);
      alert('Sorry, there was a problem submitting your request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }
}

export default HelpCenterPage;