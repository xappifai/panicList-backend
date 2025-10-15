// Script to create a test provider using Firebase Admin SDK
import { adminAuth, adminDb } from '../config/firebase-admin.js';
import { createUserDocument } from '../models/User.js';

async function createTestProvider() {
  try {
    console.log('Creating test provider using Firebase Admin SDK...');
    
    const providerData = {
      email: 'provider@test.com',
      password: 'Provider123!',
      fullName: 'John Provider',
      userType: 'provider'
    };

    // Check if user already exists
    try {
      const existingUser = await adminAuth.getUserByEmail(providerData.email);
      console.log('✅ Test provider already exists!');
      console.log('Email:', providerData.email);
      console.log('Password:', providerData.password);
      console.log('UID:', existingUser.uid);
      return;
    } catch (error) {
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
    }

    // Create user with Firebase Admin SDK
    const userRecord = await adminAuth.createUser({
      email: providerData.email,
      password: providerData.password,
      displayName: providerData.fullName,
      emailVerified: true
    });

    // Create user document in Firestore
    const userDocData = createUserDocument({
      uid: userRecord.uid,
      email: userRecord.email,
      fullName: providerData.fullName,
      userType: providerData.userType,
      status: 'active',
      phoneNumber: '+1234567890',
      address: {
        street: '123 Test Street',
        city: 'Test City',
        state: 'Test State',
        zipCode: '12345',
        country: 'Test Country'
      },
      businessInfo: {
        businessName: 'Test Business',
        businessType: 'Service Provider',
        description: 'A test business for demonstration',
        website: 'https://testbusiness.com',
        licenseNumber: 'TEST123456',
        taxId: 'TAX123456789'
      },
      services: ['plumbing', 'electrical', 'cleaning'],
      verification: {
        status: 'verified',
        verifiedAt: new Date(),
        verifiedBy: 'admin'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    }, providerData.userType);

    await adminDb.collection('users').doc(userRecord.uid).set({
      ...userDocData,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log('✅ Test provider created successfully!');
    console.log('Email:', providerData.email);
    console.log('Password:', providerData.password);
    console.log('UID:', userRecord.uid);
    
  } catch (error) {
    console.error('❌ Error creating test provider:', error.message);
  }
}

// Run the script
createTestProvider().then(() => {
  console.log('Script completed.');
  process.exit(0);
}).catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
