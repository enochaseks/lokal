const { onRequest } = require('firebase-functions/v2/https');

// Simple test function
exports.testEmailSystem = onRequest(async (req, res) => {
  res.status(200).json({ 
    message: 'Email notification system is ready!', 
    timestamp: new Date().toISOString() 
  });
});