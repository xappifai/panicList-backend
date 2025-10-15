// Authentication routes
import express from 'express';
import { adminAuth as auth } from '../config/firebase-admin.js';
import firestoreService from '../services/firestoreService.js';
import authService from '../services/authService.js';
import { 
  verifyToken, 
  requireAdmin, 
  requireProvider,
  rateLimit 
} from '../middleware/auth.js';
import {
  validateUserRegistration,
  validateProviderRegistration,
  validateLogin,
  validatePasswordReset,
  validatePasswordUpdate,
  validateProfileUpdate,
  validateProviderProfileUpdate
} from '../middleware/validation.js';

const router = express.Router();

// Apply rate limiting to all auth routes
router.use(rateLimit(15 * 60 * 1000, 100)); // 100 requests per 15 minutes (increased for development)

// @route   POST /api/auth/signup
// @desc    Register a new user
// @access  Public
router.post('/signup', validateUserRegistration, async (req, res, next) => {
  try {
    const result = await authService.signUp(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/auth/signup/provider
// @desc    Register a new provider
// @access  Public
router.post('/signup/provider', validateProviderRegistration, async (req, res, next) => {
  try {
    const result = await authService.signUp(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', validateLogin, async (req, res, next) => {
  try {
    const { email, password, userType } = req.body;
    const result = await authService.signIn(email, password, userType);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/auth/google
// @desc    Login with Google
// @access  Public
router.post('/google', async (req, res, next) => {
  try {
    const result = await authService.signInWithGoogle();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Private
router.post('/logout', verifyToken, async (req, res, next) => {
  try {
    const result = await authService.signOut();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/auth/reset-password
// @desc    Send password reset email
// @access  Public
router.post('/reset-password', validatePasswordReset, async (req, res, next) => {
  try {
    const { email } = req.body;
    const result = await authService.resetPassword(email);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/auth/update-password
// @desc    Update user password
// @access  Private
router.put('/update-password', verifyToken, validatePasswordUpdate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await authService.updatePassword(currentPassword, newPassword);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', verifyToken, async (req, res, next) => {
  try {
    const result = await authService.getCurrentUser();
    res.json({
      success: true,
      user: result
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', verifyToken, validateProfileUpdate, async (req, res, next) => {
  try {
    const result = await authService.updateUserProfile(req.user.uid, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/auth/provider/profile
// @desc    Update provider profile
// @access  Private (Provider only)
router.put('/provider/profile', verifyToken, requireProvider, validateProviderProfileUpdate, async (req, res, next) => {
  try {
    const result = await authService.updateUserProfile(req.user.uid, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/auth/account
// @desc    Delete user account
// @access  Private
router.delete('/account', verifyToken, async (req, res, next) => {
  try {
    const result = await authService.deleteUser(req.user.uid);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/auth/verify-token
// @desc    Verify ID token
// @access  Public
router.post('/verify-token', async (req, res, next) => {
  try {
    const { idToken } = req.body;
    
    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: 'ID token is required'
      });
    }

    const decodedToken = await authService.verifyIdToken(idToken);
    res.json({
      success: true,
      decodedToken
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/auth/users
// @desc    Get all users (Admin only)
// @access  Private (Admin only)
router.get('/users', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const { userType, page = 1, limit = 10 } = req.query;
    
    let result;
    if (userType) {
      result = await firestoreService.getUsersByType(userType);
    } else {
      result = await firestoreService.getDocuments('users', [], 'createdAt', 'desc', parseInt(limit));
    }
    
    res.json({
      success: true,
      data: result.data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: result.data.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/auth/users/:id
// @desc    Get user by ID
// @access  Private
router.get('/users/:id', verifyToken, async (req, res, next) => {
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

// @route   PUT /api/auth/users/:id/status
// @desc    Update user status (Admin only)
// @access  Private (Admin only)
router.put('/users/:id/status', verifyToken, requireAdmin, async (req, res, next) => {
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

// @route   GET /api/auth/providers
// @desc    Get all providers
// @access  Public
router.get('/providers', async (req, res, next) => {
  try {
    const { service, page = 1, limit = 10 } = req.query;
    
    let result;
    if (service) {
      result = await firestoreService.getProvidersByService(service);
    } else {
      result = await firestoreService.getUsersByType('provider');
    }
    
    res.json({
      success: true,
      data: result.data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: result.data.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/auth/providers/:id
// @desc    Get provider by ID
// @access  Public
router.get('/providers/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await firestoreService.getDocument('users', id);
    
    if (result.success && result.data.userType !== 'provider') {
      return res.status(404).json({
        success: false,
        message: 'Provider not found'
      });
    }
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/auth/providers/:id/verify
// @desc    Verify provider (Admin only)
// @access  Private (Admin only)
router.put('/providers/:id/verify', verifyToken, requireAdmin, async (req, res, next) => {
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

// @route   GET /api/auth/stats
// @desc    Get user statistics (Admin only)
// @access  Private (Admin only)
router.get('/stats', verifyToken, requireAdmin, async (req, res, next) => {
  try {
    const result = await firestoreService.getUserStats();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
