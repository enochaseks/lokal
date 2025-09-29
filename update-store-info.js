// Script to update store address and phone number in Firestore
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, updateDoc } = require('firebase/firestore');

// Firebase configuration
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

// Store ID to update - replace with the actual store ID
const STORE_ID = "ENTER_STORE_ID_HERE"; // You'll need to update this with the actual store ID

async function updateStoreInformation() {
  try {
    // Get the current store data
    const storeRef = doc(db, "stores", STORE_ID);
    const storeSnap = await getDoc(storeRef);
    
    if (!storeSnap.exists()) {
      console.error("Store doesn't exist!");
      return;
    }

    const storeData = storeSnap.data();
    console.log("Current store information:", {
      storeName: storeData.storeName || storeData.businessName || "Unknown Store",
      storeLocation: storeData.storeLocation || storeData.address || "No address",
      phoneNumber: storeData.phoneNumber || storeData.phone || "No phone number"
    });
    
    // Update with new information
    await updateDoc(storeRef, {
      storeLocation: "123 Main Street, London, UK", // Replace with the actual address
      phoneNumber: "+44 20 1234 5678" // Replace with the actual phone number
    });
    
    console.log("Store information updated successfully!");
    
    // Verify the update
    const updatedStoreSnap = await getDoc(storeRef);
    const updatedStoreData = updatedStoreSnap.data();
    
    console.log("Updated store information:", {
      storeName: updatedStoreData.storeName || updatedStoreData.businessName || "Unknown Store",
      storeLocation: updatedStoreData.storeLocation || updatedStoreData.address || "No address",
      phoneNumber: updatedStoreData.phoneNumber || updatedStoreData.phone || "No phone number"
    });
    
  } catch (error) {
    console.error("Error updating store information:", error);
  }
}

// Run the function
updateStoreInformation().then(() => console.log("Process completed."));