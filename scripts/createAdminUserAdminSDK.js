// Script to create an admin user using Firebase Admin SDK
import { adminAuth, adminDb } from '../config/firebase-admin.js';
import { createUserDocument } from '../models/User.js';

async function createAdminUser() {
  try {
    console.log('Creating admin user using Firebase Admin SDK...');
    
    const adminData = {
      email: 'admin@paniclist.com',
      password: 'Admin123!',
      fullName: 'System Administrator',
      userType: 'admin'
    };

    // Check if user already exists
    try {
      const existingUser = await adminAuth.getUserByEmail(adminData.email);
      console.log('✅ Admin user already exists!');
      console.log('Email:', adminData.email);
      console.log('Password:', adminData.password);
      console.log('UID:', existingUser.uid);
      return;
    } catch (error) {
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
    }

    // Create user with Firebase Admin SDK
    const userRecord = await adminAuth.createUser({
      email: adminData.email,
      password: adminData.password,
      displayName: adminData.fullName,
      emailVerified: true
    });

    // Create user document in Firestore
    const userDocData = createUserDocument({
      uid: userRecord.uid,
      email: userRecord.email,
      fullName: adminData.fullName,
      userType: adminData.userType,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    }, adminData.userType);

    await adminDb.collection('users').doc(userRecord.uid).set({
      ...userDocData,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log('✅ Admin user created successfully!');
    console.log('Email:', adminData.email);
    console.log('Password:', adminData.password);
    console.log('UID:', userRecord.uid);
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
  }
}

// Run the script
createAdminUser().then(() => {
  console.log('Script completed.');
  process.exit(0);
}).catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
