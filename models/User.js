// User data models and validation schemas
import Joi from 'joi';

// User types
export const USER_TYPES = {
  CLIENT: 'client',
  PROVIDER: 'provider',
  ADMIN: 'admin'
};

// User status
export const USER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  PENDING: 'pending',
  SUSPENDED: 'suspended'
};

// Provider verification status
export const VERIFICATION_STATUS = {
  PENDING: 'pending',
  VERIFIED: 'verified',
  REJECTED: 'rejected'
};

// Base user schema
export const baseUserSchema = Joi.object({
  uid: Joi.string().required(),
  email: Joi.string().email().required(),
  fullName: Joi.string().min(2).max(100).required(),
  userType: Joi.string().valid(...Object.values(USER_TYPES)).required(),
  status: Joi.string().valid(...Object.values(USER_STATUS)).default(USER_STATUS.ACTIVE),
  createdAt: Joi.date().default(Date.now),
  updatedAt: Joi.date().default(Date.now),
  lastLoginAt: Joi.date().allow(null),
  profileImage: Joi.string().uri().allow(null),
  phoneNumber: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).allow(null),
  dateOfBirth: Joi.date().allow(null),
  address: Joi.object({
    street: Joi.string().allow(''),
    city: Joi.string().allow(''),
    state: Joi.string().allow(''),
    zipCode: Joi.string().allow(''),
    country: Joi.string().allow('')
  }).allow(null)
});

// Client-specific schema
export const clientSchema = baseUserSchema.keys({
  userType: Joi.string().valid(USER_TYPES.CLIENT).required(),
  preferences: Joi.object({
    notifications: Joi.boolean().default(true),
    emailUpdates: Joi.boolean().default(true),
    smsUpdates: Joi.boolean().default(false)
  }).default({}),
  subscription: Joi.object({
    plan: Joi.string().valid('basic', 'professional', 'advanced').default('basic'),
    status: Joi.string().valid('active', 'inactive', 'cancelled').default('inactive'),
    startDate: Joi.date().allow(null),
    endDate: Joi.date().allow(null)
  }).default({})
});

// Provider-specific schema
export const providerSchema = baseUserSchema.keys({
  userType: Joi.string().valid(USER_TYPES.PROVIDER).required(),
  businessInfo: Joi.object({
    businessName: Joi.string().min(2).max(100).allow(''),
    businessType: Joi.string().allow(''),
    description: Joi.string().max(500).allow(''),
    website: Joi.string().uri().allow(''),
    licenseNumber: Joi.string().allow(''),
    taxId: Joi.string().allow('')
  }).allow(null),
  services: Joi.array().items(Joi.string()).default([]),
  availability: Joi.object({
    monday: Joi.object({
      start: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      end: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      available: Joi.boolean().default(false)
    }).default({}),
    tuesday: Joi.object({
      start: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      end: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      available: Joi.boolean().default(false)
    }).default({}),
    wednesday: Joi.object({
      start: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      end: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      available: Joi.boolean().default(false)
    }).default({}),
    thursday: Joi.object({
      start: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      end: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      available: Joi.boolean().default(false)
    }).default({}),
    friday: Joi.object({
      start: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      end: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      available: Joi.boolean().default(false)
    }).default({}),
    saturday: Joi.object({
      start: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      end: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      available: Joi.boolean().default(false)
    }).default({}),
    sunday: Joi.object({
      start: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      end: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      available: Joi.boolean().default(false)
    }).default({})
  }).default({}),
  verification: Joi.object({
    status: Joi.string().valid(...Object.values(VERIFICATION_STATUS)).default(VERIFICATION_STATUS.PENDING),
    documents: Joi.array().items(Joi.object({
      type: Joi.string().required(),
      url: Joi.string().uri().required(),
      uploadedAt: Joi.date().default(Date.now)
    })).default([]),
    verifiedAt: Joi.date().allow(null),
    verifiedBy: Joi.string().allow(null)
  }).default({}),
  rating: Joi.object({
    average: Joi.number().min(0).max(5).default(0),
    totalReviews: Joi.number().min(0).default(0)
  }).default({}),
  pricing: Joi.object({
    hourlyRate: Joi.number().min(0).allow(null),
    serviceRates: Joi.object().pattern(Joi.string(), Joi.number().min(0)).default({})
  }).default({})
});

// Admin schema
export const adminSchema = baseUserSchema.keys({
  userType: Joi.string().valid(USER_TYPES.ADMIN).required(),
  permissions: Joi.array().items(Joi.string()).default([]),
  role: Joi.string().valid('super_admin', 'admin', 'moderator').default('admin')
});

// Validation functions
export const validateUser = (userData, userType) => {
  let schema;
  
  switch (userType) {
    case USER_TYPES.CLIENT:
      schema = clientSchema;
      break;
    case USER_TYPES.PROVIDER:
      schema = providerSchema;
      break;
    case USER_TYPES.ADMIN:
      schema = adminSchema;
      break;
    default:
      schema = baseUserSchema;
  }
  
  return schema.validate(userData, { abortEarly: false });
};

// Helper function to create user document
export const createUserDocument = (userData, userType) => {
  const validation = validateUser(userData, userType);
  
  if (validation.error) {
    throw new Error(`Validation error: ${validation.error.details.map(d => d.message).join(', ')}`);
  }
  
  return validation.value;
};
