// Script to find and update the "Shantee Hair Pick Up" store with address and phone
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs, doc, updateDoc } = require('firebase/firestore');

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

async function findAndUpdateStore() {
  try {
    console.log("🔍 Searching for 'Shantee Hair Pick Up' store...");
    
    // Search for stores with the name "Shantee Hair Pick Up"
    const storesRef = collection(db, 'stores');
    const q = query(storesRef, where('storeName', '==', 'Shantee Hair Pick Up'));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.log("❌ No store found with name 'Shantee Hair Pick Up'");
      console.log("🔍 Let me try searching by businessName...");
      
      // Try searching by businessName field
      const q2 = query(storesRef, where('businessName', '==', 'Shantee Hair Pick Up'));
      const querySnapshot2 = await getDocs(q2);
      
      if (querySnapshot2.empty) {
        console.log("❌ No store found with businessName 'Shantee Hair Pick Up' either");
        console.log("🔍 Let me try searching by name field...");
        
        // Try searching by name field
        const q3 = query(storesRef, where('name', '==', 'Shantee Hair Pick Up'));
        const querySnapshot3 = await getDocs(q3);
        
        if (querySnapshot3.empty) {
          console.log("❌ No store found with any name field matching 'Shantee Hair Pick Up'");
          return;
        } else {
          console.log("✅ Found store with 'name' field!");
          await updateFoundStore(querySnapshot3);
        }
      } else {
        console.log("✅ Found store with 'businessName' field!");
        await updateFoundStore(querySnapshot2);
      }
    } else {
      console.log("✅ Found store with 'storeName' field!");
      await updateFoundStore(querySnapshot);
    }
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

async function updateFoundStore(querySnapshot) {
  querySnapshot.forEach(async (docSnapshot) => {
    const storeId = docSnapshot.id;
    const storeData = docSnapshot.data();
    
    console.log(`\n📋 Found store: ${storeId}`);
    console.log("Current store data:", {
      storeName: storeData.storeName,
      businessName: storeData.businessName,
      name: storeData.name,
      storeLocation: storeData.storeLocation,
      address: storeData.address,
      phoneNumber: storeData.phoneNumber,
      phone: storeData.phone
    });
    
    console.log("\n🔄 Updating store with address and phone...");
    
    try {
      // Update the store with address and phone information
      await updateDoc(doc(db, 'stores', storeId), {
        storeLocation: "123 Main Street, Your City, Your Country", // REPLACE WITH ACTUAL ADDRESS
        phoneNumber: "+1-555-123-4567", // REPLACE WITH ACTUAL PHONE
        address: "123 Main Street, Your City, Your Country", // Alternative address field
        phone: "+1-555-123-4567" // Alternative phone field
      });
      
      console.log("✅ Store updated successfully!");
      console.log("\n📝 Updated fields:");
      console.log("- storeLocation: 123 Main Street, Your City, Your Country");
      console.log("- phoneNumber: +1-555-123-4567");
      console.log("- address: 123 Main Street, Your City, Your Country");
      console.log("- phone: +1-555-123-4567");
      
      console.log("\n🎉 Now refresh your receipts page to see the address and phone!");
      
    } catch (updateError) {
      console.error("❌ Error updating store:", updateError);
    }
  });
}

// Run the function
findAndUpdateStore();