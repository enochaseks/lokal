// Simple script to update store address and phone number in Firestore
// To use this:
// 1. Run `npm install firebase`
// 2. Update STORE_ID below with the actual store ID from the receipt
// 3. Run the script with `node update-store-direct.js`

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, updateDoc } = require('firebase/firestore');

// Firebase configuration - this should match your actual configuration
const firebaseConfig = {
  apiKey: "AIzaSyBCiWfiFOKRpPUVPizcxUJmkJU4v1qUwPQ",
  authDomain: "localcommerce-58da9.firebaseapp.com",
  projectId: "localcommerce-58da9",
  storageBucket: "localcommerce-58da9.appspot.com",
  messagingSenderId: "549751612399",
  appId: "1:549751612399:web:142249217fb2c1bd3d5e4f",
  measurementId: "G-LHE9KRGF9J"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// THIS IS THE STORE ID FROM THE RECEIPT YOU ARE VIEWING
// You need to replace this with the actual store ID from your receipt
const STORE_ID = "REPLACE_WITH_ACTUAL_STORE_ID"; 

// This is the function that will directly update the store information
async function updateStoreInformation() {
  if (STORE_ID === "REPLACE_WITH_ACTUAL_STORE_ID") {
    console.error("⚠️ ERROR: You need to replace STORE_ID with the actual store ID from your receipt!");
    return;
  }
  
  try {
    // First, let's get the current store information
    const storeRef = doc(db, "stores", STORE_ID);
    const storeDoc = await getDoc(storeRef);
    
    if (!storeDoc.exists()) {
      console.error(`⚠️ ERROR: No store found with ID: ${STORE_ID}`);
      return;
    }
    
    // Get the current data
    const storeData = storeDoc.data();
    console.log("Current store information:");
    console.log("- Store name:", storeData.storeName || storeData.businessName || "Unknown");
    console.log("- Store address:", storeData.storeLocation || "Not provided");
    console.log("- Phone number:", storeData.phoneNumber || "Not provided");
    
    // Now let's update the store information with new address and phone
    await updateDoc(storeRef, {
      // Update these values with the actual address and phone number
      storeLocation: "123 Main Street, London, UK", // REPLACE WITH ACTUAL ADDRESS
      phoneNumber: "+44 20 1234 5678", // REPLACE WITH ACTUAL PHONE NUMBER
      phoneType: "work" // This can be 'work' or 'personal'
    });
    
    console.log("\n✅ Store information updated successfully!");
    
    // Let's verify the update worked
    const updatedStoreDoc = await getDoc(storeRef);
    const updatedData = updatedStoreDoc.data();
    console.log("\nUpdated store information:");
    console.log("- Store name:", updatedData.storeName || updatedData.businessName || "Unknown");
    console.log("- Store address:", updatedData.storeLocation || "Not provided");
    console.log("- Phone number:", updatedData.phoneNumber || "Not provided");
    
  } catch (error) {
    console.error("❌ Error updating store information:", error);
  }
}

// Run the function
updateStoreInformation()
  .then(() => console.log("\nProcess completed. Refresh the receipts page to see the updated information."))
  .catch(error => console.error("Failed to run update:", error));