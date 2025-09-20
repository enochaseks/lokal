/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {setGlobalOptions} = require("firebase-functions/v2");
const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");

// Set global options for v2 functions
setGlobalOptions({
  maxInstances: 10,
  timeoutSeconds: 60,
  memory: "256MiB"
});

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// Simple health check function to prevent deployment timeouts
exports.helloWorld = onRequest((request, response) => {
  try {
    logger.info("Hello logs!", {structuredData: true});
    response.status(200).send("Hello from Firebase!");
  } catch (error) {
    logger.error("Error in helloWorld function:", error);
    response.status(500).send("Internal Server Error");
  }
});
