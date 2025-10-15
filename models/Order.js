// Order model for Panic List
import Joi from 'joi';

// Order status constants
export const ORDER_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded'
};

// Payment status constants
export const PAYMENT_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
  REFUNDED: 'refunded',
  PARTIALLY_REFUNDED: 'partially_refunded'
};

// Order validation schema
export const orderSchema = Joi.object({
  // Required fields
  customerId: Joi.string().required().messages({
    'string.empty': 'Customer ID is required',
    'any.required': 'Customer ID is required'
  }),
  
  providerId: Joi.string().required().messages({
    'string.empty': 'Provider ID is required',
    'any.required': 'Provider ID is required'
  }),
  
  listingId: Joi.string().required().messages({
    'string.empty': 'Listing ID is required',
    'any.required': 'Listing ID is required'
  }),

  // Service details
  serviceDetails: Joi.object({
    title: Joi.string().required().messages({
      'string.empty': 'Service title is required',
      'any.required': 'Service title is required'
    }),
    category: Joi.string().required().messages({
      'string.empty': 'Service category is required',
      'any.required': 'Service category is required'
    }),
    description: Joi.string().allow('').optional(),
    pricing: Joi.object({
      type: Joi.string().valid('hourly', 'fixed', 'per_sqft').required(),
      amount: Joi.number().positive().required(),
      currency: Joi.string().default('USD'),
      description: Joi.string().allow('').optional()
    }).required()
  }).required(),

  // Booking details
  bookingDetails: Joi.object({
    scheduledDate: Joi.date().iso().required().messages({
      'date.format': 'Scheduled date must be a valid ISO date',
      'any.required': 'Scheduled date is required'
    }),
    scheduledTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required().messages({
      'string.pattern.base': 'Scheduled time must be in HH:MM format',
      'any.required': 'Scheduled time is required'
    }),
    duration: Joi.number().positive().optional(), // in hours
    address: Joi.string().required().messages({
      'string.empty': 'Service address is required',
      'any.required': 'Service address is required'
    }),
    notes: Joi.string().allow('').optional(),
    specialInstructions: Joi.string().allow('').optional()
  }).required(),

  // Pricing breakdown
  pricing: Joi.object({
    baseAmount: Joi.number().positive().required(),
    taxes: Joi.number().min(0).default(0),
    fees: Joi.number().min(0).default(0),
    discounts: Joi.number().min(0).default(0),
    totalAmount: Joi.number().positive().required(),
    currency: Joi.string().default('USD')
  }).required(),

  // Status fields
  status: Joi.string().valid(...Object.values(ORDER_STATUS)).default(ORDER_STATUS.PENDING),
  paymentStatus: Joi.string().valid(...Object.values(PAYMENT_STATUS)).default(PAYMENT_STATUS.PENDING),

  // Optional fields
  orderNumber: Joi.string().optional(),
  estimatedCompletion: Joi.date().iso().optional(),
  actualStartTime: Joi.date().iso().optional(),
  actualEndTime: Joi.date().iso().optional(),
  
  // Communication
  messages: Joi.array().items(Joi.object({
    senderId: Joi.string().required(),
    senderType: Joi.string().valid('customer', 'provider', 'admin').required(),
    message: Joi.string().required(),
    timestamp: Joi.date().iso().default(() => new Date()),
    isRead: Joi.boolean().default(false)
  })).default([]),

  // Reviews and ratings
  review: Joi.object({
    rating: Joi.number().min(1).max(5).optional(),
    comment: Joi.string().allow('').optional(),
    submittedAt: Joi.date().iso().optional()
  }).optional(),

  // Cancellation details
  cancellation: Joi.object({
    reason: Joi.string().allow('').optional(),
    cancelledBy: Joi.string().valid('customer', 'provider', 'admin').optional(),
    cancelledAt: Joi.date().iso().optional(),
    refundAmount: Joi.number().min(0).optional()
  }).optional(),

  // Metadata
  metadata: Joi.object({
    source: Joi.string().default('web'), // web, mobile, api
    userAgent: Joi.string().allow('').optional(),
    ipAddress: Joi.string().allow('').optional(),
    referralSource: Joi.string().allow('').optional()
  }).optional()
});

// Create order document with validation
export const createOrderDocument = (orderData) => {
  const { error, value } = orderSchema.validate(orderData, { 
    abortEarly: false,
    stripUnknown: true 
  });

  if (error) {
    const errorMessages = error.details.map(detail => detail.message);
    throw new Error(`Validation error: ${errorMessages.join(', ')}`);
  }

  // Generate order number if not provided
  if (!value.orderNumber) {
    value.orderNumber = `PNL-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
  }

  // Add timestamps
  const now = new Date();
  value.createdAt = now;
  value.updatedAt = now;

  return value;
};

// Update order document with validation
export const updateOrderDocument = (existingOrder, updateData) => {
  // Create a partial schema for updates
  const updateSchema = orderSchema.fork(Object.keys(orderSchema.describe().keys), (schema) => schema.optional());
  
  const { error, value } = updateSchema.validate(updateData, { 
    abortEarly: false,
    stripUnknown: true 
  });

  if (error) {
    const errorMessages = error.details.map(detail => detail.message);
    throw new Error(`Validation error: ${errorMessages.join(', ')}`);
  }

  // Update timestamp
  value.updatedAt = new Date();

  return { ...existingOrder, ...value };
};

// Order filters validation
export const orderFiltersSchema = Joi.object({
  status: Joi.string().valid(...Object.values(ORDER_STATUS)).optional(),
  paymentStatus: Joi.string().valid(...Object.values(PAYMENT_STATUS)).optional(),
  customerId: Joi.string().optional(),
  providerId: Joi.string().optional(),
  listingId: Joi.string().optional(),
  dateFrom: Joi.date().iso().optional(),
  dateTo: Joi.date().iso().optional(),
  sortBy: Joi.string().valid('createdAt', 'scheduledDate', 'totalAmount', 'status').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0)
});

export default {
  ORDER_STATUS,
  PAYMENT_STATUS,
  orderSchema,
  createOrderDocument,
  updateOrderDocument,
  orderFiltersSchema
};
