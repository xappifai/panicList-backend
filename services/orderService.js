// Order service for business logic and database operations
import { adminDb } from '../config/firebase-admin.js';
import { 
  createOrderDocument, 
  updateOrderDocument, 
  orderFiltersSchema,
  ORDER_STATUS,
  PAYMENT_STATUS 
} from '../models/Order.js';
import { v4 as uuidv4 } from 'uuid';
import stripeService from './stripeService.js';

const COLLECTION_NAME = 'orders';

class OrderService {
  // Create a new order
  async createOrder(orderData, customerId) {
    try {
      // Add customer ID to order data
      const dataWithCustomer = {
        ...orderData,
        customerId
      };

      // Validate and create order document
      const validatedOrder = createOrderDocument(dataWithCustomer);
      
      // Add to Firestore
      const docRef = await adminDb.collection(COLLECTION_NAME).add(validatedOrder);
      
      // Get the created document
      const createdOrder = await docRef.get();
      
      return {
        id: docRef.id,
        ...createdOrder.data()
      };
    } catch (error) {
      console.error('Error creating order:', error);
      throw new Error(`Failed to create order: ${error.message}`);
    }
  }

  // Get order by ID
  async getOrderById(orderId) {
    try {
      const doc = await adminDb.collection(COLLECTION_NAME).doc(orderId).get();
      
      if (!doc.exists) {
        return {
          success: false,
          message: 'Order not found'
        };
      }
      
      return {
        success: true,
        data: {
          id: doc.id,
          ...doc.data()
        }
      };
    } catch (error) {
      console.error('Error getting order:', error);
      return {
        success: false,
        message: `Failed to get order: ${error.message}`
      };
    }
  }

  // Get order by order number
  async getOrderByOrderNumber(orderNumber) {
    try {
      const snapshot = await adminDb.collection(COLLECTION_NAME)
        .where('orderNumber', '==', orderNumber)
        .limit(1)
        .get();
      
      if (snapshot.empty) {
        throw new Error('Order not found');
      }
      
      const doc = snapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data()
      };
    } catch (error) {
      console.error('Error getting order by order number:', error);
      throw new Error(`Failed to get order: ${error.message}`);
    }
  }

  // Get orders with filters and pagination
  async getOrders(filters = {}) {
    try {
      // Validate filters
      const { error, value: validatedFilters } = orderFiltersSchema.validate(filters);
      if (error) {
        throw new Error(`Invalid filters: ${error.details.map(d => d.message).join(', ')}`);
      }
      
      let query = adminDb.collection(COLLECTION_NAME);
      
      // Apply filters - use simple queries to avoid index requirements
      if (validatedFilters.status) {
        query = query.where('status', '==', validatedFilters.status);
      }
      
      if (validatedFilters.paymentStatus) {
        query = query.where('paymentStatus', '==', validatedFilters.paymentStatus);
      }
      
      if (validatedFilters.customerId) {
        query = query.where('customerId', '==', validatedFilters.customerId);
      }
      
      if (validatedFilters.providerId) {
        query = query.where('providerId', '==', validatedFilters.providerId);
      }
      
      if (validatedFilters.listingId) {
        query = query.where('listingId', '==', validatedFilters.listingId);
      }
      
      // Note: Removed orderBy to avoid composite index requirement
      // We'll sort in memory instead
      
      // Note: Simplified pagination to avoid index requirements
      // We'll handle pagination in memory after sorting
      
      const snapshot = await query.get();
      const orders = [];
      
      snapshot.forEach(doc => {
        orders.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      // Sort in memory to avoid index requirement
      const sortField = validatedFilters.sortBy || 'createdAt';
      const sortOrder = validatedFilters.sortOrder || 'desc';
      
      orders.sort((a, b) => {
        let aValue = a[sortField];
        let bValue = b[sortField];
        
        // Handle nested fields
        if (sortField.includes('.')) {
          const fields = sortField.split('.');
          aValue = fields.reduce((obj, field) => obj?.[field], a);
          bValue = fields.reduce((obj, field) => obj?.[field], b);
        }
        
        // Handle dates
        if (aValue && typeof aValue.toDate === 'function') {
          aValue = aValue.toDate();
        }
        if (bValue && typeof bValue.toDate === 'function') {
          bValue = bValue.toDate();
        }
        
        if (sortOrder === 'desc') {
          return bValue > aValue ? 1 : -1;
        } else {
          return aValue > bValue ? 1 : -1;
        }
      });
      
      // Apply date filters in memory
      let filteredOrders = orders;
      if (validatedFilters.dateFrom || validatedFilters.dateTo) {
        filteredOrders = orders.filter(order => {
          const orderDate = order.scheduledDate?.toDate ? order.scheduledDate.toDate() : new Date(order.scheduledDate);
          
          if (validatedFilters.dateFrom) {
            const fromDate = new Date(validatedFilters.dateFrom);
            if (orderDate < fromDate) return false;
          }
          
          if (validatedFilters.dateTo) {
            const toDate = new Date(validatedFilters.dateTo);
            if (orderDate > toDate) return false;
          }
          
          return true;
        });
      }
      
      // Apply pagination in memory
      const startIndex = validatedFilters.offset;
      const endIndex = startIndex + validatedFilters.limit;
      const paginatedOrders = filteredOrders.slice(startIndex, endIndex);
      
      return {
        orders: paginatedOrders,
        total: filteredOrders.length,
        limit: validatedFilters.limit,
        offset: validatedFilters.offset
      };
    } catch (error) {
      console.error('Error getting orders:', error);
      throw new Error(`Failed to get orders: ${error.message}`);
    }
  }

  // Get orders by customer
  async getOrdersByCustomer(customerId, filters = {}) {
    try {
      const customerFilters = {
        ...filters,
        customerId
      };
      
      return await this.getOrders(customerFilters);
    } catch (error) {
      console.error('Error getting customer orders:', error);
      throw new Error(`Failed to get customer orders: ${error.message}`);
    }
  }

  // Get orders by provider
  async getOrdersByProvider(providerId, filters = {}) {
    try {
      const providerFilters = {
        ...filters,
        providerId
      };
      
      return await this.getOrders(providerFilters);
    } catch (error) {
      console.error('Error getting provider orders:', error);
      throw new Error(`Failed to get provider orders: ${error.message}`);
    }
  }

  // Update order
  async updateOrder(orderId, updateData, userId, userType) {
    try {
      // Get existing order
      const orderResult = await this.getOrderById(orderId);
      if (!orderResult.success) {
        throw new Error(orderResult.message);
      }
      const existingOrder = orderResult.data;
      
      // Check permissions
      if ((userType === 'customer' || userType === 'client') && existingOrder.customerId !== userId) {
        throw new Error('Unauthorized: You can only update your own orders');
      }
      
      if (userType === 'provider' && existingOrder.providerId !== userId) {
        throw new Error('Unauthorized: You can only update orders for your services');
      }
      
      // Validate and update order document
      const updatedOrder = updateOrderDocument(existingOrder, updateData);
      
      // Update in Firestore
      await adminDb.collection(COLLECTION_NAME).doc(orderId).update(updatedOrder);
      
      // Return updated order
      return {
        id: orderId,
        ...updatedOrder
      };
    } catch (error) {
      console.error('Error updating order:', error);
      throw new Error(`Failed to update order: ${error.message}`);
    }
  }

  // Cancel order
  async cancelOrder(orderId, cancellationData, userId, userType) {
    try {
      const orderResult = await this.getOrderById(orderId);
      if (!orderResult.success) {
        throw new Error(orderResult.message);
      }
      const existingOrder = orderResult.data;
      
      // Check if order can be cancelled
      if (existingOrder.status === ORDER_STATUS.COMPLETED) {
        throw new Error('Cannot cancel a completed order');
      }
      
      if (existingOrder.status === ORDER_STATUS.CANCELLED) {
        throw new Error('Order is already cancelled');
      }
      
      // Check permissions
      if (userType === 'customer' && existingOrder.customerId !== userId) {
        throw new Error('Unauthorized: You can only cancel your own orders');
      }
      
      if (userType === 'provider' && existingOrder.providerId !== userId) {
        throw new Error('Unauthorized: You can only cancel orders for your services');
      }
      
      const updateData = {
        status: ORDER_STATUS.CANCELLED,
        cancellation: {
          ...cancellationData,
          cancelledBy: userType,
          cancelledAt: new Date()
        }
      };
      
      return await this.updateOrder(orderId, updateData, userId, userType);
    } catch (error) {
      console.error('Error cancelling order:', error);
      throw new Error(`Failed to cancel order: ${error.message}`);
    }
  }

  // Update order status
  async updateOrderStatus(orderId, status, userId, userType) {
    try {
      const validStatuses = Object.values(ORDER_STATUS);
      if (!validStatuses.includes(status)) {
        throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }
      
      const updateData = { status };
      
      // Add specific fields based on status
      if (status === ORDER_STATUS.IN_PROGRESS) {
        updateData.actualStartTime = new Date();
      } else if (status === ORDER_STATUS.COMPLETED) {
        updateData.actualEndTime = new Date();
      }
      
      return await this.updateOrder(orderId, updateData, userId, userType);
    } catch (error) {
      console.error('Error updating order status:', error);
      throw new Error(`Failed to update order status: ${error.message}`);
    }
  }

  // Update payment status
  async updatePaymentStatus(orderId, paymentStatus, userId, userType) {
    try {
      const validStatuses = Object.values(PAYMENT_STATUS);
      if (!validStatuses.includes(paymentStatus)) {
        throw new Error(`Invalid payment status. Must be one of: ${validStatuses.join(', ')}`);
      }
      
      const updateData = { paymentStatus };
      
      return await this.updateOrder(orderId, updateData, userId, userType);
    } catch (error) {
      console.error('Error updating payment status:', error);
      throw new Error(`Failed to update payment status: ${error.message}`);
    }
  }

  // Update payment status by order number
  async updatePaymentStatusByOrderNumber(orderNumber, paymentStatus, userId, userType) {
    try {
      const order = await this.getOrderByOrderNumber(orderNumber);
      return await this.updatePaymentStatus(order.id, paymentStatus, userId, userType);
    } catch (error) {
      console.error('Error updating payment status by order number:', error);
      throw new Error(`Failed to update payment status: ${error.message}`);
    }
  }

  // Add message to order
  async addMessage(orderId, messageData, userId, userType) {
    try {
      const orderResult = await this.getOrderById(orderId);
      if (!orderResult.success) {
        throw new Error(orderResult.message);
      }
      const existingOrder = orderResult.data;
      
      // Check permissions
      if (userType === 'customer' && existingOrder.customerId !== userId) {
        throw new Error('Unauthorized: You can only message about your own orders');
      }
      
      if (userType === 'provider' && existingOrder.providerId !== userId) {
        throw new Error('Unauthorized: You can only message about orders for your services');
      }
      
      const newMessage = {
        senderId: userId,
        senderType: userType,
        message: messageData.message,
        timestamp: new Date(),
        isRead: false
      };
      
      const updateData = {
        messages: [...(existingOrder.messages || []), newMessage]
      };
      
      return await this.updateOrder(orderId, updateData, userId, userType);
    } catch (error) {
      console.error('Error adding message:', error);
      throw new Error(`Failed to add message: ${error.message}`);
    }
  }

  // Add review to order
  async addReview(orderId, reviewData, userId, userType) {
    try {
      const orderResult = await this.getOrderById(orderId);
      if (!orderResult.success) {
        throw new Error(orderResult.message);
      }
      const existingOrder = orderResult.data;
      
      // Check permissions - only customers can add reviews
      if (userType !== 'customer' || existingOrder.customerId !== userId) {
        throw new Error('Unauthorized: Only customers can add reviews to their orders');
      }
      
      // Check if order is completed
      if (existingOrder.status !== ORDER_STATUS.COMPLETED) {
        throw new Error('Can only review completed orders');
      }
      
      // Check if review already exists
      if (existingOrder.review) {
        throw new Error('Review already exists for this order');
      }
      
      const review = {
        rating: reviewData.rating,
        comment: reviewData.comment || '',
        submittedAt: new Date()
      };
      
      const updateData = { review };
      
      return await this.updateOrder(orderId, updateData, userId, userType);
    } catch (error) {
      console.error('Error adding review:', error);
      throw new Error(`Failed to add review: ${error.message}`);
    }
  }

  // Create payment session for order
  async createPaymentSession(orderId, customerId) {
    try {
      // Get the order
      const orderResult = await this.getOrderById(orderId);
      if (!orderResult.success) {
        throw new Error(orderResult.message);
      }
      const order = orderResult.data;
      
      // Verify the customer owns this order
      if (order.customerId !== customerId) {
        throw new Error('Unauthorized: You can only pay for your own orders');
      }
      
      // Check if order is in a payable state
      if (order.status !== 'pending' && order.status !== 'confirmed') {
        throw new Error('Order is not in a payable state');
      }
      
      if (order.paymentStatus === 'paid') {
        throw new Error('Order has already been paid');
      }
      
      // Create Stripe checkout session
      const sessionData = {
        line_items: [{
          price_data: {
            currency: order.pricing.currency || 'usd',
            product_data: {
              name: order.serviceDetails.title,
              description: order.serviceDetails.description || `Service: ${order.serviceDetails.category}`,
            },
            unit_amount: Math.round(order.pricing.totalAmount * 100), // Convert to cents
          },
          quantity: 1,
        }],
        mode: 'payment',
        payment_method_types: ['card'], // Only allow card payments to avoid link payment method issues
        success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/client-dashboard/service-tracking/${orderId}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/client-dashboard/service-tracking/${orderId}`,
        metadata: {
          orderId: orderId,
          customerId: customerId,
          type: 'order_payment'
        },
        customer_email: order.customerEmail || undefined,
        allow_promotion_codes: false, // Disable promotion codes to avoid additional complexity
      };
      
      const result = await stripeService.createOrderCheckoutSession(sessionData);
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      const session = result.session;
      
      return {
        sessionId: session.id,
        url: session.url,
        orderId: orderId,
        amount: order.pricing.totalAmount,
        currency: order.pricing.currency || 'usd'
      };
    } catch (error) {
      console.error('Error creating payment session:', error);
      throw new Error(`Failed to create payment session: ${error.message}`);
    }
  }

  // Get order statistics
  async getOrderStatistics(filters = {}) {
    try {
      const result = await this.getOrders({ ...filters, limit: 100 });
      const orders = result.orders;
      
      const stats = {
        total: orders.length,
        byStatus: {},
        byPaymentStatus: {},
        totalRevenue: 0,
        averageOrderValue: 0
      };
      
      // Initialize status counters
      Object.values(ORDER_STATUS).forEach(status => {
        stats.byStatus[status] = 0;
      });
      
      Object.values(PAYMENT_STATUS).forEach(status => {
        stats.byPaymentStatus[status] = 0;
      });
      
      // Calculate statistics
      orders.forEach(order => {
        stats.byStatus[order.status]++;
        stats.byPaymentStatus[order.paymentStatus]++;
        
        if (order.paymentStatus === PAYMENT_STATUS.PAID) {
          stats.totalRevenue += order.pricing?.totalAmount || 0;
        }
      });
      
      if (orders.length > 0) {
        stats.averageOrderValue = stats.totalRevenue / orders.filter(o => o.paymentStatus === PAYMENT_STATUS.PAID).length;
      }
      
      return stats;
    } catch (error) {
      console.error('Error getting order statistics:', error);
      throw new Error(`Failed to get order statistics: ${error.message}`);
    }
  }
}

export default new OrderService();
