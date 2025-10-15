// Authentication service using Firebase Admin SDK
import admin from '../config/firebase-admin.js';
import { adminAuth, adminDb } from '../config/firebase-admin.js';
import { createUserDocument, USER_TYPES } from '../models/User.js';
// Import client SDK for password verification
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../config/firebase.js';

class AuthService {
  // Sign up a new user
  async signUp(userData) {
    try {
      const { email, password, fullName, userType } = userData;

      // Create user with Firebase Admin Auth
      const userRecord = await adminAuth.createUser({
        email: email,
        password: password,
        displayName: fullName,
        emailVerified: false
      });

      // Create user document in Firestore
      const baseUserData = {
        uid: userRecord.uid,
        email: userRecord.email,
        fullName: fullName,
        userType: userType,
        status: 'active',
        emailVerified: false
      };

      // Add provider-specific fields only for providers
      if (userType === 'provider') {
        baseUserData.phoneNumber = userData.phoneNumber || null;
        baseUserData.businessInfo = userData.businessInfo || null;
        baseUserData.services = userData.services || [];
        baseUserData.address = userData.address || null;
        baseUserData.verificationStatus = 'pending';
      } else {
        // Add client-specific fields
        baseUserData.phoneNumber = userData.phoneNumber || null;
        baseUserData.address = userData.address || null;
      }

      const userDocData = createUserDocument(baseUserData, userType);

      await adminDb.collection('users').doc(userRecord.uid).set({
        ...userDocData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Generate a custom token for the user
      const customToken = await adminAuth.createCustomToken(userRecord.uid);

      return {
        success: true,
        user: {
          uid: userRecord.uid,
          email: userRecord.email,
          fullName: fullName,
          userType: userType,
          emailVerified: false
        },
        customToken: customToken,
        message: 'User created successfully. Please verify your email.'
      };
    } catch (error) {
      // Handle specific Firebase errors
      if (error.code === 'auth/email-already-exists') {
        throw new Error('Email already in use. Please use a different email or try logging in.');
      } else if (error.code === 'auth/invalid-password') {
        throw new Error('Password is too weak. Please choose a stronger password.');
      } else if (error.code === 'auth/invalid-email') {
        throw new Error('Invalid email address. Please check your email format.');
      } else {
        throw new Error(`Sign up failed: ${error.message}`);
      }
    }
  }

  // Sign in with email and password
  async signIn(email, password, expectedUserType = null) {
    try {
      // Verify credentials using client SDK (this validates the password)
      let userCredential;
      try {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      } catch (error) {
        if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
          throw new Error('Invalid email or password');
        }
        if (error.code === 'auth/too-many-requests') {
          throw new Error('Too many failed login attempts. Please try again later.');
        }
        throw error;
      }

      const user = userCredential.user;

      // Get user data from Firestore using Admin SDK (with proper permissions)
      const userDocRef = adminDb.collection('users').doc(user.uid);
      const userDoc = await userDocRef.get();
      
      if (!userDoc.exists) {
        throw new Error('User document not found');
      }

      const userData = userDoc.data();

      // Validate user type if provided
      if (expectedUserType && userData.userType !== expectedUserType) {
        throw new Error(`This account is registered as a ${userData.userType}. Please select the correct user type.`);
      }

      // Check if user is active
      if (userData.status === 'suspended' || userData.status === 'inactive') {
        throw new Error('Your account has been suspended or is inactive. Please contact support.');
      }

      // Update last login time
      await userDocRef.update({
        lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Get the ID token from the authenticated user
      const idToken = await user.getIdToken();
      
      return {
        success: true,
        user: {
          uid: user.uid,
          email: user.email,
          fullName: userData.fullName,
          userType: userData.userType,
          status: userData.status,
          emailVerified: user.emailVerified,
          profileImage: userData.profileImage || null,
          ...userData
        },
        token: idToken,
        message: 'Sign in successful'
      };
    } catch (error) {
      throw new Error(`Sign in failed: ${error.message}`);
    }
  }

  // Sign in with Google (This should be handled on the client side)
  // This method is kept for compatibility but should not be used server-side
  async signInWithGoogle() {
    throw new Error('Google sign-in should be handled on the client side. Use the verifyIdToken method after client-side authentication.');
  }

  // Sign out (handled on client side, no server action needed)
  async signOut() {
    return {
      success: true,
      message: 'Sign out successful (handled on client side)'
    };
  }

  // Send password reset email
  async resetPassword(email) {
    try {
      // Generate password reset link using Admin SDK
      const link = await adminAuth.generatePasswordResetLink(email);
      
      // Note: You would typically send this link via email using a service like SendGrid, Nodemailer, etc.
      // For now, we'll just return success
      
      return {
        success: true,
        message: 'Password reset email sent',
        resetLink: link // In production, don't return this - send it via email
      };
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        throw new Error('No user found with this email address');
      }
      throw new Error(`Password reset failed: ${error.message}`);
    }
  }

  // Update user password
  async updatePassword(uid, newPassword) {
    try {
      await adminAuth.updateUser(uid, {
        password: newPassword
      });

      return {
        success: true,
        message: 'Password updated successfully'
      };
    } catch (error) {
      throw new Error(`Password update failed: ${error.message}`);
    }
  }

  // Get current user by UID
  async getCurrentUser(uid) {
    try {
      if (!uid) {
        return null;
      }

      const userDocRef = adminDb.collection('users').doc(uid);
      const userDoc = await userDocRef.get();
      
      if (!userDoc.exists) {
        return null;
      }

      const userData = userDoc.data();
      const userRecord = await adminAuth.getUser(uid);

      return {
        uid: userRecord.uid,
        email: userRecord.email,
        fullName: userData.fullName,
        userType: userData.userType,
        status: userData.status,
        emailVerified: userRecord.emailVerified,
        profileImage: userData.profileImage,
        ...userData
      };
    } catch (error) {
      throw new Error(`Get current user failed: ${error.message}`);
    }
  }

  // Verify ID token (for server-side verification)
  async verifyIdToken(idToken) {
    try {
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      return decodedToken;
    } catch (error) {
      throw new Error(`Token verification failed: ${error.message}`);
    }
  }

  // Create custom token (for server-side user creation)
  async createCustomToken(uid, additionalClaims = {}) {
    try {
      const customToken = await adminAuth.createCustomToken(uid, additionalClaims);
      return customToken;
    } catch (error) {
      throw new Error(`Custom token creation failed: ${error.message}`);
    }
  }

  // Update user profile
  async updateUserProfile(uid, updateData) {
    try {
      const userRef = adminDb.collection('users').doc(uid);
      await userRef.update({
        ...updateData,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return {
        success: true,
        message: 'Profile updated successfully'
      };
    } catch (error) {
      throw new Error(`Profile update failed: ${error.message}`);
    }
  }

  // Delete user account
  async deleteUser(uid) {
    try {
      // Mark user document as deleted in Firestore
      const userRef = adminDb.collection('users').doc(uid);
      await userRef.update({
        status: 'deleted',
        deletedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Optionally delete the user from Firebase Auth
      // await adminAuth.deleteUser(uid);
      
      return {
        success: true,
        message: 'User account deleted successfully'
      };
    } catch (error) {
      throw new Error(`User deletion failed: ${error.message}`);
    }
  }
}

export default new AuthService();
