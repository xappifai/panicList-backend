// src/services/feedbackService.js
import admin from '../config/firebase-admin.js';
import { adminDb } from '../config/firebase-admin.js';

// Create a new feedback/review
export const createFeedback = async (feedbackData) => {
  try {
    // Validate that the order exists and belongs to the client
    const orderRef = adminDb.collection('orders').doc(feedbackData.orderId);
    const orderSnap = await orderRef.get();
    
    if (!orderSnap.exists) {
      throw new Error('Order not found');
    }
    
    const order = orderSnap.data();
    // Check both clientId and customerId for compatibility
    const orderClientId = order.clientId || order.customerId;
    if (orderClientId !== feedbackData.clientId) {
      throw new Error('You can only review your own orders');
    }
    
    // Check if order has been paid
    if (order.paymentStatus !== 'paid') {
      throw new Error('You can only review paid orders');
    }
    
    // Check if feedback already exists for this order
    const feedbackQuery = adminDb.collection('feedback')
      .where('orderId', '==', feedbackData.orderId);
    const existingFeedbackSnap = await feedbackQuery.get();
    
    if (!existingFeedbackSnap.empty) {
      throw new Error('You have already reviewed this order');
    }
    
    // Get additional data for the feedback
    const [clientRef, providerRef, serviceRef] = await Promise.all([
      adminDb.collection('users').doc(feedbackData.clientId).get(),
      adminDb.collection('users').doc(feedbackData.providerId).get(),
      feedbackData.serviceId ? adminDb.collection('listings').doc(feedbackData.serviceId).get() : null
    ]);
    
    if (!clientRef.exists || !providerRef.exists) {
      throw new Error('Invalid client or provider');
    }
    
    const client = clientRef.data();
    const provider = providerRef.data();
    const service = serviceRef?.data();
    
    // Create the feedback document
    const feedbackDoc = {
      orderId: feedbackData.orderId,
      clientId: feedbackData.clientId,
      providerId: feedbackData.providerId,
      serviceId: feedbackData.serviceId || null,
      rating: feedbackData.rating,
      comment: feedbackData.comment || '',
      status: 'approved', // Auto-approve reviews
      serviceName: service?.title || order.serviceName || 'Service',
      providerName: provider.fullName || 'Provider',
      clientName: client.fullName || 'Client',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    const feedbackRef = await adminDb.collection('feedback').add(feedbackDoc);
    
    // Update provider's average rating
    await updateProviderRating(feedbackData.providerId);
    
    return {
      success: true,
      data: { id: feedbackRef.id, ...feedbackDoc },
      message: 'Review submitted successfully'
    };
  } catch (error) {
    console.error('Error creating feedback:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Get feedback by ID
export const getFeedbackById = async (feedbackId) => {
  try {
    const feedbackRef = adminDb.collection('feedback').doc(feedbackId);
    const feedbackSnap = await feedbackRef.get();
    
    if (!feedbackSnap.exists) {
      throw new Error('Feedback not found');
    }
    
    return {
      success: true,
      data: { id: feedbackSnap.id, ...feedbackSnap.data() }
    };
  } catch (error) {
    console.error('Error getting feedback:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Get feedbacks for a provider
export const getProviderFeedbacks = async (providerId, page = 1, pageLimit = 10) => {
  try {
    // Get all feedbacks and filter client-side to avoid index requirement
    const feedbackQuery = adminDb.collection('feedback');
    const feedbackSnap = await feedbackQuery.get();
    
    const allFeedbacks = feedbackSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Filter by providerId and status, then sort by createdAt
    const providerFeedbacks = allFeedbacks
      .filter(feedback => feedback.providerId === providerId && feedback.status === 'approved')
      .sort((a, b) => {
        const aTime = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const bTime = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return bTime - aTime;
      });
    
    // Simple pagination
    const startIndex = (page - 1) * pageLimit;
    const endIndex = startIndex + pageLimit;
    const paginatedFeedbacks = providerFeedbacks.slice(startIndex, endIndex);
    
    return {
      success: true,
      data: paginatedFeedbacks,
      pagination: {
        page,
        limit: pageLimit,
        total: providerFeedbacks.length,
        totalPages: Math.ceil(providerFeedbacks.length / pageLimit)
      }
    };
  } catch (error) {
    console.error('Error getting provider feedbacks:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Get feedbacks by client
export const getClientFeedbacks = async (clientId, page = 1, pageLimit = 10) => {
  try {
    console.log('getClientFeedbacks called with clientId:', clientId);
    
    // Get all feedbacks and filter client-side to avoid index requirement
    const feedbackQuery = adminDb.collection('feedback');
    const feedbackSnap = await feedbackQuery.get();
    
    const allFeedbacks = feedbackSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log('All feedbacks found:', allFeedbacks.length);
    console.log('All feedback clientIds:', allFeedbacks.map(f => f.clientId));
    
    // Filter by clientId and sort by createdAt
    const clientFeedbacks = allFeedbacks
      .filter(feedback => feedback.clientId === clientId)
      .sort((a, b) => {
        const aTime = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const bTime = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return bTime - aTime;
      });
    
    console.log('Filtered client feedbacks:', clientFeedbacks.length);
    
    // Simple pagination
    const startIndex = (page - 1) * pageLimit;
    const endIndex = startIndex + pageLimit;
    const paginatedFeedbacks = clientFeedbacks.slice(startIndex, endIndex);
    
    return {
      success: true,
      data: paginatedFeedbacks,
      pagination: {
        page,
        limit: pageLimit,
        total: clientFeedbacks.length,
        totalPages: Math.ceil(clientFeedbacks.length / pageLimit)
      }
    };
  } catch (error) {
    console.error('Error getting client feedbacks:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Get all feedbacks (Admin only)
export const getAllFeedbacks = async (page = 1, pageLimit = 10, filters = {}) => {
  try {
    let feedbackQuery = adminDb.collection('feedback')
      .orderBy('createdAt', 'desc');
    
    // Apply filters
    if (filters.status) {
      feedbackQuery = feedbackQuery.where('status', '==', filters.status);
    }
    if (filters.rating) {
      feedbackQuery = feedbackQuery.where('rating', '==', filters.rating);
    }
    if (filters.providerId) {
      feedbackQuery = feedbackQuery.where('providerId', '==', filters.providerId);
    }
    if (filters.clientId) {
      feedbackQuery = feedbackQuery.where('clientId', '==', filters.clientId);
    }
    
    const feedbackSnap = await feedbackQuery.get();
    const feedbacks = feedbackSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Simple pagination
    const startIndex = (page - 1) * pageLimit;
    const endIndex = startIndex + pageLimit;
    const paginatedFeedbacks = feedbacks.slice(startIndex, endIndex);
    
    return {
      success: true,
      data: paginatedFeedbacks,
      pagination: {
        page,
        limit: pageLimit,
        total: feedbacks.length,
        totalPages: Math.ceil(feedbacks.length / pageLimit)
      }
    };
  } catch (error) {
    console.error('Error getting all feedbacks:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Update feedback status (Admin only)
export const updateFeedbackStatus = async (feedbackId, status, adminId) => {
  try {
    const feedbackRef = adminDb.collection('feedback').doc(feedbackId);
    const feedbackSnap = await feedbackRef.get();
    
    if (!feedbackSnap.exists) {
      throw new Error('Feedback not found');
    }
    
    await feedbackRef.update({
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Update provider rating if status changed to approved
    if (status === 'approved') {
      const feedback = feedbackSnap.data();
      await updateProviderRating(feedback.providerId);
    }
    
    return {
      success: true,
      data: { id: feedbackId, ...feedbackSnap.data(), status },
      message: 'Feedback status updated successfully'
    };
  } catch (error) {
    console.error('Error updating feedback status:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Delete feedback
export const deleteFeedback = async (feedbackId, userId, userType) => {
  try {
    const feedbackRef = adminDb.collection('feedback').doc(feedbackId);
    const feedbackSnap = await feedbackRef.get();
    
    if (!feedbackSnap.exists) {
      throw new Error('Feedback not found');
    }
    
    const feedback = feedbackSnap.data();
    
    // Check permissions
    if (userType !== 'admin' && feedback.clientId !== userId) {
      throw new Error('You can only delete your own reviews');
    }
    
    await feedbackRef.delete();
    
    // Update provider rating
    await updateProviderRating(feedback.providerId);
    
    return {
      success: true,
      message: 'Feedback deleted successfully'
    };
  } catch (error) {
    console.error('Error deleting feedback:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Update provider's average rating
const updateProviderRating = async (providerId) => {
  try {
    const feedbackQuery = adminDb.collection('feedback')
      .where('providerId', '==', providerId)
      .where('status', '==', 'approved');
    
    const feedbackSnap = await feedbackQuery.get();
    const feedbacks = feedbackSnap.docs.map(doc => doc.data());
    
    if (feedbacks.length === 0) {
      // No reviews, set to 0
      await adminDb.collection('users').doc(providerId).update({
        averageRating: 0,
        totalReviews: 0
      });
      return;
    }
    
    const totalRating = feedbacks.reduce((sum, feedback) => sum + feedback.rating, 0);
    const averageRating = Math.round((totalRating / feedbacks.length) * 10) / 10;
    
    await adminDb.collection('users').doc(providerId).update({
      averageRating,
      totalReviews: feedbacks.length
    });
    
    console.log(`Updated provider ${providerId} rating: ${averageRating} (${feedbacks.length} reviews)`);
  } catch (error) {
    console.error('Error updating provider rating:', error);
  }
};

// Get feedback statistics
export const getFeedbackStats = async (providerId = null) => {
  try {
    let feedbackQuery = adminDb.collection('feedback')
      .where('status', '==', 'approved');
    
    if (providerId) {
      feedbackQuery = feedbackQuery.where('providerId', '==', providerId);
    }
    
    const feedbackSnap = await feedbackQuery.get();
    const feedbacks = feedbackSnap.docs.map(doc => doc.data());
    
    if (feedbacks.length === 0) {
      return {
        success: true,
        data: {
          totalReviews: 0,
          averageRating: 0,
          ratingDistribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }
        }
      };
    }
    
    const totalRating = feedbacks.reduce((sum, feedback) => sum + feedback.rating, 0);
    const averageRating = Math.round((totalRating / feedbacks.length) * 10) / 10;
    
    const ratingDistribution = feedbacks.reduce((dist, feedback) => {
      const rating = feedback.rating.toString();
      dist[rating] = (dist[rating] || 0) + 1;
      return dist;
    }, { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 });
    
    return {
      success: true,
      data: {
        totalReviews: feedbacks.length,
        averageRating,
        ratingDistribution
      }
    };
  } catch (error) {
    console.error('Error getting feedback stats:', error);
    return {
      success: false,
      error: error.message
    };
  }
};