// Setup script for initial database configuration
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, collection, writeBatch } from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBMVzjSw3q4WXftoCwpKW-I1nkK4RTTL8U",
  authDomain: "panic-list.firebaseapp.com",
  projectId: "panic-list",
  // Correct Storage bucket domain
  storageBucket: "panic-list.appspot.com",
  messagingSenderId: "426253936509",
  appId: "1:426253936509:web:e6dab939f475f3d15c4e14",
  measurementId: "G-P7Z7GTCW5N"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Create initial admin user
async function createInitialAdmin() {
  try {
    const adminData = {
      uid: 'admin-001',
      email: 'admin@paniclist.com',
      fullName: 'Super Admin',
      userType: 'admin',
      status: 'active',
      role: 'super_admin',
      permissions: ['all'],
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: null,
      profileImage: null,
      phoneNumber: null,
      dateOfBirth: null,
      address: null
    };

    await setDoc(doc(db, 'users', 'admin-001'), adminData);
    console.log('✅ Initial admin user created');
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  }
}

// Create sample services
async function createSampleServices() {
  try {
    const services = [
      { id: 'plumbing', name: 'Plumbing', description: 'Plumbing services and repairs' },
      { id: 'electrical', name: 'Electrical', description: 'Electrical services and repairs' },
      { id: 'hvac', name: 'HVAC', description: 'Heating, ventilation, and air conditioning' },
      { id: 'cleaning', name: 'Cleaning', description: 'House and office cleaning services' },
      { id: 'handyman', name: 'Handyman', description: 'General handyman services' },
      { id: 'landscaping', name: 'Landscaping', description: 'Garden and lawn care services' },
      { id: 'moving', name: 'Moving', description: 'Moving and relocation services' },
      { id: 'tutoring', name: 'Tutoring', description: 'Educational and tutoring services' }
    ];

    const batch = writeBatch(db);
    
    services.forEach(service => {
      const serviceRef = doc(collection(db, 'services'));
      batch.set(serviceRef, {
        ...service,
        createdAt: new Date(),
        updatedAt: new Date(),
        active: true
      });
    });

    await batch.commit();
    console.log('✅ Sample services created');
  } catch (error) {
    console.error('❌ Error creating services:', error);
  }
}

// Create sample business types
async function createSampleBusinessTypes() {
  try {
    const businessTypes = [
      'Individual Contractor',
      'Small Business',
      'Medium Business',
      'Large Corporation',
      'Franchise',
      'Non-Profit Organization',
      'Government Entity'
    ];

    const batch = writeBatch(db);
    
    businessTypes.forEach((type, index) => {
      const typeRef = doc(collection(db, 'businessTypes'));
      batch.set(typeRef, {
        id: `type-${index + 1}`,
        name: type,
        createdAt: new Date(),
        updatedAt: new Date(),
        active: true
      });
    });

    await batch.commit();
    console.log('✅ Sample business types created');
  } catch (error) {
    console.error('❌ Error creating business types:', error);
  }
}

// Setup Firestore security rules (for reference)
function printSecurityRules() {
  console.log(`
📋 Firestore Security Rules (copy to Firebase Console):

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      allow read: if request.auth != null && 
        (resource.data.userType == 'provider' && resource.data.status == 'active');
      allow read, write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.userType == 'admin';
    }
    
    // Services collection
    match /services/{serviceId} {
      allow read: if true;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.userType == 'admin';
    }
    
    // Business types collection
    match /businessTypes/{typeId} {
      allow read: if true;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.userType == 'admin';
    }
  }
}
  `);
}

// Main setup function
async function setup() {
  console.log('🚀 Setting up Panic List database...\n');
  
  try {
    await createInitialAdmin();
    await createSampleServices();
    await createSampleBusinessTypes();
    
    console.log('\n✅ Database setup completed successfully!');
    printSecurityRules();
    
    console.log('\n📝 Next steps:');
    console.log('1. Copy the security rules to your Firebase Console');
    console.log('2. Set up Firebase Authentication providers');
    console.log('3. Configure your frontend to use the API endpoints');
    console.log('4. Test the API endpoints with Postman or your frontend');
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

// Run setup
setup();
