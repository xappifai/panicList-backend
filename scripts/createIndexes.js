// Script to create required Firestore indexes
// Run this script to create the necessary composite indexes for the application

import { adminDb } from '../config/firebase-admin.js';

const createIndexes = async () => {
  console.log('🔧 Creating Firestore indexes...');
  
  try {
    // Note: Firestore composite indexes cannot be created programmatically
    // They must be created through the Firebase Console or using the Firebase CLI
    
    console.log('📋 Required indexes to create:');
    console.log('');
    
    console.log('1. Users Collection Index:');
    console.log('   Collection: users');
    console.log('   Fields: userType (Ascending), createdAt (Descending)');
    console.log('   URL: https://console.firebase.google.com/v1/r/project/paniclist-a3524/firestore/indexes?create_composite=Ck1wcm9qZWN0cy9wYW5pY2xpc3QtYTM1MjQvZGF0YWJhc2VzLyhkZWZhdWx0KS9jb2xsZWN0aW9uR3JvdXBzL3VzZXJzL2luZGV4ZXMvXxABGgwKCHVzZXJUeXBlEAEaDQoJY3JlYXRlZEF0EAIaDAoIX19uYW1lX18QAg');
    console.log('');
    
    console.log('2. Listings Collection Index:');
    console.log('   Collection: listings');
    console.log('   Fields: featured (Ascending), status (Ascending), createdAt (Descending)');
    console.log('   URL: https://console.firebase.google.com/v1/r/project/paniclist-a3524/firestore/indexes?create_composite=ClBwcm9qZWN0cy9wYW5pY2xpc3QtYTM1MjQvZGF0YWJhc2VzLyhkZWZhdWx0KS9jb2xsZWN0aW9uR3JvdXBzL2xpc3RpbmdzL2luZGV4ZXMvXxABGgwKCGZlYXR1cmVkEAEaCgoGc3RhdHVzEAEaDQoJY3JlYXRlZEF0EAIaDAoIX19uYW1lX18QAg');
    console.log('');
    
    console.log('3. Listings Collection Index (Provider):');
    console.log('   Collection: listings');
    console.log('   Fields: providerId (Ascending), status (Ascending), createdAt (Descending)');
    console.log('');
    
    console.log('4. Listings Collection Index (Category):');
    console.log('   Collection: listings');
    console.log('   Fields: category (Ascending), status (Ascending), createdAt (Descending)');
    console.log('');
    
    console.log('🚀 To create these indexes:');
    console.log('1. Click on the URLs above to open Firebase Console');
    console.log('2. Or use Firebase CLI: firebase firestore:indexes');
    console.log('3. Or create them manually in Firebase Console > Firestore > Indexes');
    console.log('');
    
    console.log('⏳ Index creation typically takes 2-10 minutes');
    console.log('✅ Once created, the application will work properly');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
};

// Run the script
createIndexes();
