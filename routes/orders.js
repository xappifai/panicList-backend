// routes/orders.js
import express from 'express';
import orderService from '../services/orderService.js';
import { verifyToken, requireClient, requireProvider, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// -----------------------------
// Helpers
// -----------------------------
const sendError = (res, error, defaultMsg, codes = {}) => {
  console.error(defaultMsg, error);
  const status = Object.entries(codes).find(([key]) => error.message?.includes(key))?.[1] || 500;
  res.status(status).json({ success: false, message: error.message || defaultMsg });
};

const ensureOwnership = (order, userId, userType) => {
  if (userType === 'customer' && order.customerId !== userId) {
    const err = new Error('Unauthorized: You can only access your own orders');
    err.status = 403;
    throw err;
  }
  
  if (userType === 'provider' && order.providerId !== userId) {
    const err = new Error('Unauthorized: You can only access orders for your services');
    err.status = 403;
    throw err;
  }
};

// -----------------------------
// Public Routes (No Auth Required)
// -----------------------------

// GET /api/orders/statistics - Get public order statistics
router.get('/statistics', async (req, res) => {
  try {
    const stats = await orderService.getOrderStatistics(req.query);
    res.json({ success: true, data: stats, message: 'Order statistics retrieved successfully' });
  } catch (error) {
    sendError(res, error, 'Failed to retrieve order statistics');
  }
});

// -----------------------------
// Protected Routes (Auth Required)
// -----------------------------

// GET /api/orders - Get orders (with filters)
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await orderService.getOrders(req.query);
    res.json({ success: true, data: result, message: 'Orders retrieved successfully' });
  } catch (error) {
    sendError(res, error, 'Failed to retrieve orders');
  }
});

// GET /api/orders/my - Get current user's orders
router.get('/my', verifyToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const userType = req.user.userType;
    
    let result;
    if (userType === 'customer') {
      result = await orderService.getOrdersByCustomer(userId, req.query);
    } else if (userType === 'provider') {
      result = await orderService.getOrdersByProvider(userId, req.query);
    } else {
      // Admin can see all orders
      result = await orderService.getOrders(req.query);
    }
    
    res.json({ success: true, data: result, message: 'User orders retrieved successfully' });
  } catch (error) {
    sendError(res, error, 'Failed to retrieve user orders');
  }
});

// GET /api/orders/customer/:customerId - Get orders by customer (admin/provider only)
router.get('/customer/:customerId', verifyToken, async (req, res) => {
  try {
    const { customerId } = req.params;
    const userId = req.user.uid;
    const userType = req.user.userType;
    
    // Check permissions
    if (userType === 'customer' && userId !== customerId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized: You can only access your own orders' 
      });
    }
    
    const result = await orderService.getOrdersByCustomer(customerId, req.query);
    res.json({ success: true, data: result, message: 'Customer orders retrieved successfully' });
  } catch (error) {
    sendError(res, error, 'Failed to retrieve customer orders');
  }
});

// GET /api/orders/provider/:providerId - Get orders by provider (admin/customer only)
router.get('/provider/:providerId', verifyToken, async (req, res) => {
  try {
    const { providerId } = req.params;
    const userId = req.user.uid;
    const userType = req.user.userType;
    
    // Check permissions
    if (userType === 'provider' && userId !== providerId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized: You can only access orders for your services' 
      });
    }
    
    const result = await orderService.getOrdersByProvider(providerId, req.query);
    res.json({ success: true, data: result, message: 'Provider orders retrieved successfully' });
  } catch (error) {
    sendError(res, error, 'Failed to retrieve provider orders');
  }
});

// GET /api/orders/:id - Get order by ID
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.uid;
    const userType = req.user.userType;
    
    const order = await orderService.getOrderById(id);
    
    // Check permissions
    ensureOwnership(order, userId, userType);
    
    res.json({ success: true, data: order, message: 'Order retrieved successfully' });
  } catch (error) {
    sendError(res, error, 'Failed to retrieve order', { 'Order not found': 404, 'Unauthorized': 403 });
  }
});

// POST /api/orders - Create new order (customers only)
router.post('/', verifyToken, requireClient, async (req, res) => {
  try {
    const orderData = req.body;
    const customerId = req.user.uid;
    
    const order = await orderService.createOrder(orderData, customerId);
    res.status(201).json({ success: true, data: order, message: 'Order created successfully' });
  } catch (error) {
    sendError(res, error, 'Failed to create order', { 'Validation error': 400 });
  }
});

// PUT /api/orders/:id - Update order
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const userId = req.user.uid;
    const userType = req.user.userType;
    
    const order = await orderService.updateOrder(id, updateData, userId, userType);
    res.json({ success: true, data: order, message: 'Order updated successfully' });
  } catch (error) {
    sendError(res, error, 'Failed to update order', { 'Order not found': 404, 'Unauthorized': 403, 'Validation error': 400 });
  }
});

// PUT /api/orders/:id/status - Update order status
router.put('/:id/status', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.uid;
    const userType = req.user.userType;
    
    const order = await orderService.updateOrderStatus(id, status, userId, userType);
    res.json({ success: true, data: order, message: 'Order status updated successfully' });
  } catch (error) {
    sendError(res, error, 'Failed to update order status', { 'Order not found': 404, 'Unauthorized': 403, 'Invalid status': 400 });
  }
});

// PUT /api/orders/:id/payment-status - Update payment status
router.put('/:id/payment-status', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentStatus } = req.body;
    const userId = req.user.uid;
    const userType = req.user.userType;
    
    const order = await orderService.updatePaymentStatus(id, paymentStatus, userId, userType);
    res.json({ success: true, data: order, message: 'Payment status updated successfully' });
  } catch (error) {
    sendError(res, error, 'Failed to update payment status', { 'Order not found': 404, 'Unauthorized': 403, 'Invalid status': 400 });
  }
});

// POST /api/orders/:id/payment - Create payment session for order
router.post('/:id/payment', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.uid;
    const userType = req.user.userType;
    
    // Only customers can pay for their orders
    if (userType !== 'client') {
      return res.status(403).json({
        success: false,
        message: 'Only customers can initiate payments'
      });
    }
    
    const result = await orderService.createPaymentSession(id, userId);
    res.json({ success: true, data: result, message: 'Payment session created successfully' });
  } catch (error) {
    sendError(res, error, 'Failed to create payment session', { 'Order not found': 404, 'Unauthorized': 403, 'Invalid order status': 400 });
  }
});

// POST /api/orders/:id/cancel - Cancel order
router.post('/:id/cancel', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const cancellationData = req.body;
    const userId = req.user.uid;
    const userType = req.user.userType;
    
    const order = await orderService.cancelOrder(id, cancellationData, userId, userType);
    res.json({ success: true, data: order, message: 'Order cancelled successfully' });
  } catch (error) {
    sendError(res, error, 'Failed to cancel order', { 'Order not found': 404, 'Unauthorized': 403, 'Cannot cancel': 400 });
  }
});

// POST /api/orders/:id/messages - Add message to order
router.post('/:id/messages', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const messageData = req.body;
    const userId = req.user.uid;
    const userType = req.user.userType;
    
    const order = await orderService.addMessage(id, messageData, userId, userType);
    res.json({ success: true, data: order, message: 'Message added successfully' });
  } catch (error) {
    sendError(res, error, 'Failed to add message', { 'Order not found': 404, 'Unauthorized': 403 });
  }
});

// POST /api/orders/:id/review - Add review to order (customers only)
router.post('/:id/review', verifyToken, requireClient, async (req, res) => {
  try {
    const { id } = req.params;
    const reviewData = req.body;
    const userId = req.user.uid;
    const userType = req.user.userType;
    
    const order = await orderService.addReview(id, reviewData, userId, userType);
    res.json({ success: true, data: order, message: 'Review added successfully' });
  } catch (error) {
    sendError(res, error, 'Failed to add review', { 'Order not found': 404, 'Unauthorized': 403, 'Cannot review': 400 });
  }
});

// GET /api/orders/statistics/user - Get user-specific order statistics
router.get('/statistics/user', verifyToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const userType = req.user.userType;
    
    let filters = req.query;
    if (userType === 'customer') {
      filters.customerId = userId;
    } else if (userType === 'provider') {
      filters.providerId = userId;
    }
    // Admin can see all statistics without filters
    
    const stats = await orderService.getOrderStatistics(filters);
    res.json({ success: true, data: stats, message: 'User order statistics retrieved successfully' });
  } catch (error) {
    sendError(res, error, 'Failed to retrieve user order statistics');
  }
});

export default router;
