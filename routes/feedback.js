// src/routes/feedback.js
import express from 'express';
import { 
  createFeedback, 
  getFeedbackById, 
  getProviderFeedbacks, 
  getClientFeedbacks, 
  getAllFeedbacks, 
  updateFeedbackStatus, 
  deleteFeedback, 
  getFeedbackStats 
} from '../services/feedbackService.js';
import orderService from '../services/orderService.js';
import { verifyToken, requireAdmin } from '../middleware/auth.js';
import { validatePagination } from '../middleware/validation.js';

const router = express.Router();

// Validation schemas
const feedbackValidation = {
  rating: {
    type: 'number',
    required: true,
    min: 1,
    max: 5,
    integer: true
  },
  comment: {
    type: 'string',
    maxLength: 1000,
    optional: true
  },
  orderId: {
    type: 'string',
    required: true
  }
};

// @route   POST /api/feedback
// @desc    Create a new feedback/review
// @access  Private
router.post('/', verifyToken, async (req, res, next) => {
  try {
    const { rating, comment, orderId } = req.body;
    const clientId = req.user.uid;
    
    // Basic validation
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }
    
    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required'
      });
    }
    
    // Get order details to extract provider and service info
    const orderResult = await orderService.getOrderById(orderId);
    
    if (!orderResult.success) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    const order = orderResult.data;
    
    const feedbackData = {
      orderId,
      clientId,
      providerId: order.providerId,
      serviceId: order.serviceId,
      rating: parseInt(rating),
      comment: comment?.trim() || ''
    };
    
    const result = await createFeedback(feedbackData);
    
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/feedback/:id
// @desc    Get feedback by ID
// @access  Private
router.get('/:id', verifyToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await getFeedbackById(id);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/feedback/provider/:providerId
// @desc    Get feedbacks for a specific provider
// @access  Public
router.get('/provider/:providerId', validatePagination, async (req, res, next) => {
  try {
    const { providerId } = req.params;
    const { page, limit } = req.query;
    
    const result = await getProviderFeedbacks(providerId, page, limit);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/feedback/client/my
// @desc    Get current client's feedbacks
// @access  Private
router.get('/client/my', verifyToken, validatePagination, async (req, res, next) => {
  try {
    const clientId = req.user.uid;
    const { page, limit } = req.query;
    
    const result = await getClientFeedbacks(clientId, page, limit);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/feedback/admin/all
// @desc    Get all feedbacks (Admin only)
// @access  Private (Admin only)
router.get('/admin/all', verifyToken, requireAdmin, validatePagination, async (req, res, next) => {
  try {
    const { page, limit, status, rating, providerId, clientId } = req.query;
    
    const filters = {};
    if (status) filters.status = status;
    if (rating) filters.rating = parseInt(rating);
    if (providerId) filters.providerId = providerId;
    if (clientId) filters.clientId = clientId;
    
    const result = await getAllFeedbacks(page, limit, filters);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/feedback/:id/status
// @desc    Update feedback status (Admin only)
// @access  Private (Admin only)
router.put('/:id/status', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const adminId = req.user.uid;
    
    if (!status || !['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status is required (pending, approved, rejected)'
      });
    }
    
    const result = await updateFeedbackStatus(id, status, adminId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/feedback/:id
// @desc    Delete feedback
// @access  Private
router.delete('/:id', verifyToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.uid;
    const userType = req.user.userType;
    
    const result = await deleteFeedback(id, userId, userType);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/feedback/stats/:providerId?
// @desc    Get feedback statistics
// @access  Public
router.get('/stats/:providerId?', async (req, res, next) => {
  try {
    const { providerId } = req.params;
    
    const result = await getFeedbackStats(providerId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    next(error);
  }
});

export default router;
