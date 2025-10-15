// User management routes
import express from 'express';
import firestoreService from '../services/firestoreService.js';
import { 
  verifyToken, 
  requireAdmin, 
  requireProvider,
  requireClient,
  requireOwnership
} from '../middleware/auth.js';
import {
  validateProfileUpdate,
  validateProviderProfileUpdate,
  validatePagination,
  validateSearch
} from '../middleware/validation.js';

const router = express.Router();

// @route   GET /api/users/search
// @desc    Search users
// @access  Private (Admin only)
router.get('/search', verifyToken, requireAdmin, validateSearch, async (req, res, next) => {
  try {
    const { q, type, page, limit } = req.query;
    const result = await firestoreService.searchUsers(q, type);
    
    // Simple pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedData = result.data.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      data: paginatedData,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: result.data.length,
        totalPages: Math.ceil(result.data.length / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/users/clients
// @desc    Get all clients
// @access  Private (Admin only)
router.get('/clients', verifyToken, requireAdmin, validatePagination, async (req, res, next) => {
  try {
    const { page, limit, sortBy, sortOrder } = req.query;
    const result = await firestoreService.getUsersByType('client');
    
    // Simple pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedData = result.data.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      data: paginatedData,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: result.data.length,
        totalPages: Math.ceil(result.data.length / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/users/providers
// @desc    Get all providers
// @access  Public
router.get('/providers', validatePagination, async (req, res, next) => {
  try {
    const { page, limit, sortBy, sortOrder } = req.query;
    const result = await firestoreService.getUsersByType('provider');
    
    // Filter only active and verified providers for public access
    const activeProviders = result.data.filter(provider => 
      provider.status === 'active' && 
      provider.verification?.status === 'verified'
    );
    
    // Simple pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedData = activeProviders.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      data: paginatedData,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: activeProviders.length,
        totalPages: Math.ceil(activeProviders.length / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/users/admin/providers
// @desc    Get all providers (Admin only - no filtering)
// @access  Private (Admin only)
router.get('/admin/providers', verifyToken, requireAdmin, validatePagination, async (req, res, next) => {
  try {
    const { page, limit, sortBy, sortOrder } = req.query;
    const result = await firestoreService.getUsersByType('provider');
    
    // Simple pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedData = result.data.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      data: paginatedData,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: result.data.length,
        totalPages: Math.ceil(result.data.length / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/users/providers/by-service/:service
// @desc    Get providers by service type
// @access  Public
router.get('/providers/by-service/:service', validatePagination, async (req, res, next) => {
  try {
    const { service } = req.params;
    const { page, limit } = req.query;
    
    const result = await firestoreService.getProvidersByService(service);
    
    // Simple pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedData = result.data.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      data: paginatedData,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: result.data.length,
        totalPages: Math.ceil(result.data.length / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/users/public/:id
// @desc    Get limited public user info by ID (fullName, email, uid)
// @access  Private (any authenticated user)
router.get('/public/:id', verifyToken, async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await firestoreService.getDocument('users', id);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const { fullName, email, uid } = result.data;

    return res.json({
      success: true,
      data: {
        uid: uid || id,
        fullName: fullName || null,
        email: email || null
      }
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private
router.get('/:id', verifyToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Users can only access their own data unless they're admin
    if (req.user.uid !== id && req.user.userType !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    const result = await firestoreService.getDocument('users', id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/users/:id
// @desc    Update user profile
// @access  Private
router.put('/:id', verifyToken, requireOwnership('id'), validateProfileUpdate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await firestoreService.updateDocument('users', id, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/users/:id/provider
// @desc    Update provider profile
// @access  Private (Provider only)
router.put('/:id/provider', verifyToken, requireProvider, requireOwnership('id'), validateProviderProfileUpdate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await firestoreService.updateDocument('users', id, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/users/:id/status
// @desc    Update user status (Admin only)
// @access  Private (Admin only)
router.put('/:id/status', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!['active', 'inactive', 'suspended'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }
    
    const result = await firestoreService.updateDocument('users', id, { status });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/users/:id/verify
// @desc    Verify provider (Admin only)
// @access  Private (Admin only)
router.put('/:id/verify', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, verifiedBy } = req.body;
    
    if (!['pending', 'verified', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification status'
      });
    }
    
    const result = await firestoreService.updateProviderVerification(id, {
      status,
      verifiedBy: verifiedBy || req.user.uid
    });
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/users/:id/rating
// @desc    Rate a provider
// @access  Private (Client only)
router.post('/:id/rating', verifyToken, requireClient, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rating } = req.body;
    
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }
    
    // Check if the user being rated is a provider
    const userResult = await firestoreService.getDocument('users', id);
    if (!userResult.success || userResult.data.userType !== 'provider') {
      return res.status(404).json({
        success: false,
        message: 'Provider not found'
      });
    }
    
    const result = await firestoreService.updateProviderRating(id, rating);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/users/:id
// @desc    Delete user (Admin only)
// @access  Private (Admin only)
router.delete('/:id', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Don't allow admins to delete themselves
    if (req.user.uid === id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }
    
    const result = await firestoreService.updateDocument('users', id, {
      status: 'deleted',
      deletedAt: new Date()
    });
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
