// Script to create an admin user for testing
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase.js';
import { createUserDocument } from '../models/User.js';

async function createAdminUser() {
  try {
    console.log('Creating admin user...');
    
    const adminData = {
      email: 'admin@paniclist.com',
      password: 'Admin123!',
      fullName: 'System Administrator',
      userType: 'admin'
    };

    // Create user with Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, adminData.email, adminData.password);
    const user = userCredential.user;

    // Update user profile
    await updateProfile(user, {
      displayName: adminData.fullName
    });

    // Create user document in Firestore
    const userDocData = createUserDocument({
      uid: user.uid,
      email: user.email,
      fullName: adminData.fullName,
      userType: adminData.userType,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    }, adminData.userType);

    await setDoc(doc(db, 'users', user.uid), {
      ...userDocData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    console.log('✅ Admin user created successfully!');
    console.log('Email:', adminData.email);
    console.log('Password:', adminData.password);
    console.log('UID:', user.uid);
    
    // Sign out after creation
    await auth.signOut();
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    
    if (error.code === 'auth/email-already-in-use') {
      console.log('ℹ️  Admin user already exists. You can use these credentials:');
      console.log('Email: admin@paniclist.com');
      console.log('Password: Admin123!');
    }
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
