// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAGEHLV7k8nAVaoqDmdbidi4j9Wm-zwOr8",
  authDomain: "lokal-b4b28.firebaseapp.com",
  databaseURL: "https://lokal-b4b28-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "lokal-b4b28",
  storageBucket: "lokal-b4b28.firebasestorage.app",
  messagingSenderId: "469061847946",
  appId: "1:469061847946:web:71c4974365a321a328d673",
  measurementId: "G-WKYD2FX255"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, analytics, db, storage }; 