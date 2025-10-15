// Firestore service for database operations using Firebase Admin SDK
import admin from '../config/firebase-admin.js';
import { adminDb } from '../config/firebase-admin.js';

class FirestoreService {
  // Generic document operations
  async createDocument(collectionName, docId, data) {
    try {
      const docRef = adminDb.collection(collectionName).doc(docId);
      await docRef.set({
        ...data,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return { success: true, id: docId };
    } catch (error) {
      throw new Error(`Create document failed: ${error.message}`);
    }
  }

  async getDocument(collectionName, docId) {
    try {
      const docRef = adminDb.collection(collectionName).doc(docId);
      const docSnap = await docRef.get();
      
      if (docSnap.exists) {
        return { success: true, data: { id: docSnap.id, ...docSnap.data() } };
      } else {
        return { success: false, message: 'Document not found' };
      }
    } catch (error) {
      throw new Error(`Get document failed: ${error.message}`);
    }
  }

  async updateDocument(collectionName, docId, data) {
    try {
      const docRef = adminDb.collection(collectionName).doc(docId);
      await docRef.update({
        ...data,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return { success: true };
    } catch (error) {
      throw new Error(`Update document failed: ${error.message}`);
    }
  }

  async deleteDocument(collectionName, docId) {
    try {
      const docRef = adminDb.collection(collectionName).doc(docId);
      await docRef.delete();
      return { success: true };
    } catch (error) {
      throw new Error(`Delete document failed: ${error.message}`);
    }
  }

  // Query operations
  async getDocuments(collectionName, filters = [], orderByField = null, orderDirection = 'asc', limitCount = null) {
    try {
      let q = adminDb.collection(collectionName);

      // Apply filters
      filters.forEach(filter => {
        q = q.where(filter.field, filter.operator, filter.value);
      });

      // Apply ordering
      if (orderByField) {
        q = q.orderBy(orderByField, orderDirection);
      }

      // Apply limit
      if (limitCount) {
        q = q.limit(limitCount);
      }

      const querySnapshot = await q.get();
      const documents = [];
      
      querySnapshot.forEach((doc) => {
        documents.push({ id: doc.id, ...doc.data() });
      });

      return { success: true, data: documents };
    } catch (error) {
      throw new Error(`Get documents failed: ${error.message}`);
    }
  }

  // User-specific operations
  async getUserByEmail(email) {
    try {
      const q = adminDb.collection('users').where('email', '==', email);
      const querySnapshot = await q.get();
      
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        return { success: true, data: { id: doc.id, ...doc.data() } };
      } else {
        return { success: false, message: 'User not found' };
      }
    } catch (error) {
      throw new Error(`Get user by email failed: ${error.message}`);
    }
  }

  async getUsersByType(userType) {
    try {
      // Use simple query without ordering to avoid index requirement
      const q = adminDb.collection('users').where('userType', '==', userType);
      const querySnapshot = await q.get();
      
      const users = [];
      querySnapshot.forEach((doc) => {
        users.push({ id: doc.id, ...doc.data() });
      });

      // Sort in memory to avoid index requirement
      users.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return dateB - dateA;
      });

      return { success: true, data: users };
    } catch (error) {
      throw new Error(`Get users by type failed: ${error.message}`);
    }
  }

  async getProvidersByService(serviceType) {
    try {
      const q = adminDb.collection('users')
        .where('userType', '==', 'provider')
        .where('services', 'array-contains', serviceType)
        .where('status', '==', 'active');
      const querySnapshot = await q.get();
      
      const providers = [];
      querySnapshot.forEach((doc) => {
        providers.push({ id: doc.id, ...doc.data() });
      });

      return { success: true, data: providers };
    } catch (error) {
      throw new Error(`Get providers by service failed: ${error.message}`);
    }
  }

  // Provider-specific operations
  async updateProviderVerification(providerId, verificationData) {
    try {
      const docRef = adminDb.collection('users').doc(providerId);
      await docRef.update({
        'verification.status': verificationData.status,
        'verification.verifiedAt': verificationData.status === 'verified' ? admin.firestore.FieldValue.serverTimestamp() : null,
        'verification.verifiedBy': verificationData.verifiedBy || null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return { success: true };
    } catch (error) {
      throw new Error(`Update provider verification failed: ${error.message}`);
    }
  }

  async updateProviderRating(providerId, newRating) {
    try {
      const docRef = adminDb.collection('users').doc(providerId);
      const docSnap = await docRef.get();
      
      if (docSnap.exists) {
        const currentData = docSnap.data();
        const currentRating = currentData.rating || { average: 0, totalReviews: 0 };
        
        const totalReviews = currentRating.totalReviews + 1;
        const newAverage = ((currentRating.average * currentRating.totalReviews) + newRating) / totalReviews;
        
        await docRef.update({
          'rating.average': Math.round(newAverage * 10) / 10, // Round to 1 decimal place
          'rating.totalReviews': totalReviews,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        return { success: true };
      } else {
        throw new Error('Provider not found');
      }
    } catch (error) {
      throw new Error(`Update provider rating failed: ${error.message}`);
    }
  }

  // Batch operations
  async batchCreate(collectionName, documents) {
    try {
      const batch = adminDb.batch();
      
      documents.forEach(docData => {
        const docRef = adminDb.collection(collectionName).doc();
        batch.set(docRef, {
          ...docData,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });
      
      await batch.commit();
      return { success: true };
    } catch (error) {
      throw new Error(`Batch create failed: ${error.message}`);
    }
  }

  async batchUpdate(collectionName, updates) {
    try {
      const batch = adminDb.batch();
      
      updates.forEach(update => {
        const docRef = adminDb.collection(collectionName).doc(update.id);
        batch.update(docRef, {
          ...update.data,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });
      
      await batch.commit();
      return { success: true };
    } catch (error) {
      throw new Error(`Batch update failed: ${error.message}`);
    }
  }

  // Transaction operations
  async runTransaction(updateFunction) {
    try {
      const result = await adminDb.runTransaction(updateFunction);
      return { success: true, data: result };
    } catch (error) {
      throw new Error(`Transaction failed: ${error.message}`);
    }
  }

  // Search operations
  async searchUsers(searchTerm, userType = null) {
    try {
      let q = adminDb.collection('users');
      
      if (userType) {
        q = q.where('userType', '==', userType);
      }
      
      const querySnapshot = await q.get();
      const users = [];
      
      querySnapshot.forEach((doc) => {
        const userData = doc.data();
        const searchableText = `${userData.fullName} ${userData.email}`.toLowerCase();
        
        if (searchableText.includes(searchTerm.toLowerCase())) {
          users.push({ id: doc.id, ...userData });
        }
      });
      
      return { success: true, data: users };
    } catch (error) {
      throw new Error(`Search users failed: ${error.message}`);
    }
  }

  // Analytics and reporting
  async getUserStats() {
    try {
      const [clients, providers, admins] = await Promise.all([
        this.getUsersByType('client'),
        this.getUsersByType('provider'),
        this.getUsersByType('admin')
      ]);
      
      return {
        success: true,
        data: {
          totalUsers: clients.data.length + providers.data.length + admins.data.length,
          clients: clients.data.length,
          providers: providers.data.length,
          admins: admins.data.length
        }
      };
    } catch (error) {
      throw new Error(`Get user stats failed: ${error.message}`);
    }
  }

  // Real-time listeners (for future implementation)
  async subscribeToCollection(collectionName, callback, filters = []) {
    try {
      // Note: Real-time listeners with Admin SDK are not typically used in server environments
      // This method is kept for compatibility but should be implemented differently
      return { success: true, message: 'Real-time listeners should be implemented on the client side' };
    } catch (error) {
      throw new Error(`Subscribe to collection failed: ${error.message}`);
    }
  }
}

export default new FirestoreService();
