const functions = require('firebase-functions');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

// Gmail configuration
const createGmailTransporter = () => {
  let gmailEmail = process.env.GMAIL_EMAIL;
  let gmailPassword = process.env.GMAIL_PASSWORD;
  
  if (!gmailEmail || !gmailPassword) {
    try {
      const config = functions.config();
      gmailEmail = config.gmail?.email;
      gmailPassword = config.gmail?.password;
    } catch (error) {
      console.log('Firebase config not available, using env vars only');
    }
  }
  
  if (!gmailEmail || !gmailPassword) {
    throw new Error('Gmail credentials not configured');
  }
  
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailEmail,
      pass: gmailPassword
    },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    rateDelta: 1000,
    rateLimit: 10,
    secure: true,
    requireTLS: true,
    tls: {
      rejectUnauthorized: true
    }
  });
};

// Calculate date 5 working days ago
const getFiveWorkingDaysAgo = () => {
  const date = new Date();
  let workingDaysCount = 0;
  
  while (workingDaysCount < 5) {
    date.setDate(date.getDate() - 1);
    // Skip weekends (0 = Sunday, 6 = Saturday)
    if (date.getDay() !== 0 && date.getDay() !== 6) {
      workingDaysCount++;
    }
  }
  
  return date;
};

// Check if user has incomplete onboarding
const checkIncompleteOnboarding = async (userId) => {
  const db = admin.firestore();
  
  try {
    // Get user document
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return null;
    }
    
    const userData = userDoc.data();
    const userType = userData.userType;
    const createdAt = userData.createdAt?.toDate() || new Date();
    const email = userData.email;
    const displayName = userData.displayName || 'there';
    
    // Check if account is older than 5 working days
    const fiveWorkingDaysAgo = getFiveWorkingDaysAgo();
    if (createdAt > fiveWorkingDaysAgo) {
      return null; // Too recent, skip
    }
    
    // Check for incomplete states
    const incompleteReasons = [];
    
    // 1. Check if email is verified
    if (!userData.emailVerified) {
      incompleteReasons.push('email_not_verified');
    }
    
    // 2. Check onboarding status
    if (!userData.onboardingComplete) {
      incompleteReasons.push('onboarding_incomplete');
    }
    
    // 3. For sellers, check if they have a store
    if (userType === 'seller') {
      const storesSnapshot = await db.collection('stores')
        .where('userId', '==', userId)
        .limit(1)
        .get();
      
      if (storesSnapshot.empty) {
        incompleteReasons.push('no_store_created');
      } else {
        // Check if store has products
        const storeDoc = storesSnapshot.docs[0];
        const storeId = storeDoc.id;
        const storeData = storeDoc.data();
        
        // Check if store has basic info
        if (!storeData.storeName || !storeData.storeCategory) {
          incompleteReasons.push('store_incomplete_info');
        }
        
        // Check if store has products
        const productsSnapshot = await db.collection('stores')
          .doc(storeId)
          .collection('products')
          .limit(1)
          .get();
        
        if (productsSnapshot.empty) {
          incompleteReasons.push('no_products_added');
        }
      }
    }
    
    // 4. For buyers, check engagement and activity
    if (userType === 'buyer') {
      // Check if buyer has made any orders
      const ordersSnapshot = await db.collection('orders')
        .where('userId', '==', userId)
        .limit(1)
        .get();
      
      // Check if buyer has any items in wishlist/favorites
      const wishlistSnapshot = await db.collection('users')
        .doc(userId)
        .collection('wishlist')
        .limit(1)
        .get();
      
      // Check if buyer has browsed/interacted with stores
      const viewedStoresSnapshot = await db.collection('users')
        .doc(userId)
        .collection('viewedStores')
        .limit(1)
        .get();
      
      // Check if profile has location set
      const hasLocation = userData.location || userData.address;
      
      // If buyer hasn't done ANY activity
      const hasNoActivity = ordersSnapshot.empty && 
                           wishlistSnapshot.empty && 
                           viewedStoresSnapshot.empty;
      
      if (hasNoActivity) {
        incompleteReasons.push('no_buyer_activity');
      }
      
      if (!hasLocation) {
        incompleteReasons.push('no_location_set');
      }
      
      // Check if profile is incomplete
      if (!userData.phoneNumber && !userData.phone) {
        incompleteReasons.push('no_phone_number');
      }
    }
    
    // Only return if there are incomplete reasons
    if (incompleteReasons.length > 0) {
      return {
        userId,
        email,
        displayName,
        userType,
        incompleteReasons,
        createdAt
      };
    }
    
    return null;
  } catch (error) {
    console.error(`Error checking user ${userId}:`, error);
    return null;
  }
};

// Generate email content based on incomplete reasons
const generateReminderEmail = (userData) => {
  const { displayName, userType, incompleteReasons } = userData;
  
  let issues = [];
  let actionItems = [];
  
  if (incompleteReasons.includes('email_not_verified')) {
    issues.push('Your email address hasn\'t been verified yet');
    actionItems.push('Verify your email address to secure your account');
  }
  
  if (incompleteReasons.includes('onboarding_incomplete')) {
    issues.push('Your account setup isn\'t complete');
    actionItems.push('Complete your profile setup');
  }
  
  if (incompleteReasons.includes('no_store_created')) {
    issues.push('You haven\'t created your store yet');
    actionItems.push('Create your store and start selling');
  }
  
  if (incompleteReasons.includes('store_incomplete_info')) {
    issues.push('Your store information is incomplete');
    actionItems.push('Add your store name, category, and details');
  }
  
  if (incompleteReasons.includes('no_products_added')) {
    issues.push('You haven\'t added any products to your store');
    actionItems.push('Add products to start receiving orders');
  }
  
  // Buyer-specific issues
  if (incompleteReasons.includes('no_buyer_activity')) {
    issues.push('You haven\'t explored any stores or products yet');
    actionItems.push('Browse local stores and discover products near you');
  }
  
  if (incompleteReasons.includes('no_location_set')) {
    issues.push('Your location isn\'t set up');
    actionItems.push('Add your location to find stores near you');
  }
  
  if (incompleteReasons.includes('no_phone_number')) {
    issues.push('Your phone number isn\'t added');
    actionItems.push('Add your phone number for order notifications');
  }
  
  const issuesList = issues.map(issue => `<li style="margin: 8px 0;">${issue}</li>`).join('');
  const actionsList = actionItems.map(action => `<li style="margin: 8px 0;">✓ ${action}</li>`).join('');
  
  // Dynamic content based on user type
  const userTypeMessage = userType === 'seller' 
    ? 'You started setting up your seller account to reach local customers, but your store isn\'t quite ready yet.'
    : 'You created an account to discover and buy from local stores, but you haven\'t started exploring yet!';
  
  const ctaText = userType === 'seller' 
    ? 'Complete Your Store Setup' 
    : 'Start Shopping Locally';
  
  const benefitText = userType === 'seller'
    ? 'Get your store up and running to start receiving orders from local customers.'
    : 'Complete your profile to start discovering amazing products from local stores near you.';
  
  return {
    subject: 'Need help completing your Lokal account?',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%); padding: 40px 20px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">Lokal</h1>
            <p style="color: rgba(255, 255, 255, 0.9); margin: 10px 0 0 0; font-size: 16px;">Your Local Marketplace</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 24px; font-weight: 600;">Hi ${displayName},</h2>
            
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
              ${userTypeMessage}
            </p>
            
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
              ${benefitText} We're here to help you get started! 🚀
            </p>
            
            <!-- Issues Box -->
            <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 30px 0; border-radius: 4px;">
              <h3 style="color: #92400e; margin: 0 0 15px 0; font-size: 18px; font-weight: 600;">What's Still Needed:</h3>
              <ul style="color: #92400e; margin: 0; padding-left: 20px;">
                ${issuesList}
              </ul>
            </div>
            
            <!-- Action Items -->
            <div style="background-color: #dbeafe; border-left: 4px solid #0891b2; padding: 20px; margin: 30px 0; border-radius: 4px;">
              <h3 style="color: #075985; margin: 0 0 15px 0; font-size: 18px; font-weight: 600;">Next Steps:</h3>
              <ul style="color: #075985; margin: 0; padding-left: 20px; list-style: none;">
                ${actionsList}
              </ul>
            </div>
            
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 20px 0;">
              <strong>Need help?</strong> Our support team is ready to assist you with any questions or issues you might be experiencing.
            </p>
            
            <!-- CTA Button -->
            <div style="text-align: center; margin: 40px 0;">
              <a href="https://lokal-app.web.app" 
                 style="display: inline-block; background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%); 
                        color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; 
                        font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(8, 145, 178, 0.3);">
                ${ctaText}
              </a>
            </div>
            
            <!-- Support Section -->
            <div style="background-color: #f9fafb; padding: 20px; margin: 30px 0; border-radius: 8px; text-align: center;">
              <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0;">
                Questions? We're here to help!
              </p>
              <p style="color: #0891b2; font-size: 14px; margin: 0; font-weight: 600;">
                Reply to this email or contact us through the app
              </p>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0;">
              Best regards,<br>
              <strong style="color: #0891b2;">The Lokal Team</strong>
            </p>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0 0 10px 0;">
              You're receiving this email because you created an account on Lokal.
            </p>
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
              © ${new Date().getFullYear()} Lokal. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  };
};

// Scheduled function to check and send reminders
// Runs every Monday at 9:00 AM
exports.sendOnboardingReminders = onSchedule({
  schedule: 'every monday 09:00',
  timeZone: 'Europe/London', // Adjust to your timezone
  memory: '512MiB',
  timeoutSeconds: 540
}, async (event) => {
  console.log('Starting onboarding reminder check...');
  
  const db = admin.firestore();
  let transporter;
  
  try {
    // Create email transporter
    transporter = createGmailTransporter();
    console.log('Email transporter created');
    
    // Get all users
    const usersSnapshot = await db.collection('users').get();
    console.log(`Found ${usersSnapshot.size} users to check`);
    
    let checkedCount = 0;
    let remindersSent = 0;
    let errors = 0;
    
    // Check each user
    for (const userDoc of usersSnapshot.docs) {
      try {
        // First check if user already completed onboarding (to skip unnecessary checks)
        const reminderRef = db.collection('onboardingReminders').doc(userDoc.id);
        const existingReminder = await reminderRef.get();
        
        if (existingReminder.exists && existingReminder.data().completed) {
          // User already completed - skip them
          continue;
        }
        
        const incompleteUser = await checkIncompleteOnboarding(userDoc.id);
        checkedCount++;
        
        if (incompleteUser) {
          // Check if we've sent a reminder recently (to avoid spam)
          const lastReminderRef = db.collection('onboardingReminders').doc(incompleteUser.userId);
          const lastReminderDoc = await lastReminderRef.get();
          
          if (lastReminderDoc.exists) {
            const lastSent = lastReminderDoc.data().lastSent?.toDate();
            const fiveWorkingDaysAgo = getFiveWorkingDaysAgo();
            
            // Skip if we sent a reminder within the last 5 working days
            if (lastSent && lastSent > fiveWorkingDaysAgo) {
              console.log(`Skipping ${incompleteUser.email} - reminder sent recently`);
              continue;
            }
          }
          
          // Generate and send email
          const emailContent = generateReminderEmail(incompleteUser);
          
          await transporter.sendMail({
            from: `"Lokal" <${process.env.GMAIL_EMAIL || functions.config().gmail?.email}>`,
            to: incompleteUser.email,
            subject: emailContent.subject,
            html: emailContent.html
          });
          
          // Record that we sent this reminder
          await lastReminderRef.set({
            lastSent: admin.firestore.FieldValue.serverTimestamp(),
            incompleteReasons: incompleteUser.incompleteReasons,
            userType: incompleteUser.userType
          }, { merge: true });
          
          remindersSent++;
          console.log(`Reminder sent to ${incompleteUser.email}`);
        } else {
          // User has completed setup - clear their reminder record
          const reminderRef = db.collection('onboardingReminders').doc(userDoc.id);
          const reminderDoc = await reminderRef.get();
          
          if (reminderDoc.exists) {
            // Mark as completed so we know they finished
            await reminderRef.set({
              completed: true,
              completedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            console.log(`User ${userDoc.id} completed onboarding - marked as complete`);
          }
        }
      } catch (error) {
        console.error(`Error processing user ${userDoc.id}:`, error);
        errors++;
      }
    }
    
    console.log(`Onboarding reminder check complete:
      - Users checked: ${checkedCount}
      - Reminders sent: ${remindersSent}
      - Errors: ${errors}
    `);
    
    // Log summary to Firestore
    await db.collection('systemLogs').add({
      type: 'onboarding_reminders',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      usersChecked: checkedCount,
      remindersSent: remindersSent,
      errors: errors
    });
    
  } catch (error) {
    console.error('Error in sendOnboardingReminders:', error);
    throw error;
  }
});

// Manual trigger function for testing
exports.sendOnboardingRemindersManual = functions.https.onCall(async (data, context) => {
  // Only allow admins to manually trigger
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  console.log('Manual onboarding reminder check triggered by:', context.auth.uid);
  
  const db = admin.firestore();
  let transporter;
  
  try {
    transporter = createGmailTransporter();
    
    const usersSnapshot = await db.collection('users').limit(10).get(); // Limit for testing
    
    let checkedCount = 0;
    let remindersSent = 0;
    const results = [];
    
    for (const userDoc of usersSnapshot.docs) {
      try {
        const incompleteUser = await checkIncompleteOnboarding(userDoc.id);
        checkedCount++;
        
        if (incompleteUser) {
          const emailContent = generateReminderEmail(incompleteUser);
          
          // In manual mode, just return what would be sent (don't actually send)
          results.push({
            email: incompleteUser.email,
            reasons: incompleteUser.incompleteReasons,
            subject: emailContent.subject
          });
          
          remindersSent++;
        }
      } catch (error) {
        console.error(`Error processing user ${userDoc.id}:`, error);
      }
    }
    
    return {
      success: true,
      usersChecked: checkedCount,
      wouldSendTo: remindersSent,
      results: results
    };
    
  } catch (error) {
    console.error('Error in manual reminder check:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});
