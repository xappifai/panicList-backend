// Firebase configuration and initialization
import { initializeApp } from 'firebase/app';

import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';


// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || '',
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.FIREBASE_APP_ID || '',
  measurementId: process.env.FIREBASE_MEASUREMENT_ID || ''
};
console.log(firebaseConfig)

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services

export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
// Note: Analytics is not available in Node.js backend environment

export default app;
