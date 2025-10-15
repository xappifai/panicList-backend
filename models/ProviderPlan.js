import Joi from 'joi';

// Provider Plan Schema
export const providerPlanSchema = Joi.object({
  providerId: Joi.string().required(),
  planName: Joi.string().valid('free', 'basic', 'premium', 'enterprise').required(),
  planType: Joi.string().valid('monthly', 'yearly').required(),
  status: Joi.string().valid('active', 'expired', 'cancelled', 'pending').default('pending'),
  startDate: Joi.date().default(Date.now),
  endDate: Joi.date().required(),
  daysRemaining: Joi.number().integer().min(0).default(0),
  price: Joi.number().min(0).default(0),
  currency: Joi.string().default('usd'),
  stripeSubscriptionId: Joi.string().allow(null, ''),
  stripeCustomerId: Joi.string().allow(null, ''),
  stripePaymentIntentId: Joi.string().allow(null, ''),
  features: Joi.object({
    maxListings: Joi.number().integer().min(0).default(5),
    maxImages: Joi.number().integer().min(0).default(10),
    prioritySupport: Joi.boolean().default(false),
    analytics: Joi.boolean().default(false),
    customDomain: Joi.boolean().default(false),
    apiAccess: Joi.boolean().default(false),
    whiteLabel: Joi.boolean().default(false)
  }).default(),
  autoRenew: Joi.boolean().default(true),
  createdAt: Joi.date().default(Date.now),
  updatedAt: Joi.date().default(Date.now)
});

// Plan Configuration
export const PLAN_CONFIG = {
  free: {
    name: 'Free',
    monthly: { price: 0, days: 30 },
    yearly: { price: 0, days: 365 },
    features: {
      maxListings: 5,
      maxImages: 10,
      prioritySupport: false,
      analytics: false,
      customDomain: false,
      apiAccess: false,
      whiteLabel: false
    }
  },
  basic: {
    name: 'Basic',
    monthly: { price: 29.99, days: 30 },
    yearly: { price: 299.99, days: 365 },
    features: {
      maxListings: 25,
      maxImages: 50,
      prioritySupport: true,
      analytics: true,
      customDomain: false,
      apiAccess: false,
      whiteLabel: false
    }
  },
  premium: {
    name: 'Premium',
    monthly: { price: 59.99, days: 30 },
    yearly: { price: 599.99, days: 365 },
    features: {
      maxListings: 100,
      maxImages: 200,
      prioritySupport: true,
      analytics: true,
      customDomain: true,
      apiAccess: true,
      whiteLabel: false
    }
  },
  enterprise: {
    name: 'Enterprise',
    monthly: { price: 99.99, days: 30 },
    yearly: { price: 999.99, days: 365 },
    features: {
      maxListings: -1, // unlimited
      maxImages: -1, // unlimited
      prioritySupport: true,
      analytics: true,
      customDomain: true,
      apiAccess: true,
      whiteLabel: true
    }
  }
};

// Helper functions
export const calculateEndDate = (planType, startDate = new Date()) => {
  const endDate = new Date(startDate);
  const days = PLAN_CONFIG[planType]?.monthly?.days || 30;
  endDate.setDate(endDate.getDate() + days);
  return endDate;
};

export const calculateDaysRemaining = (endDate) => {
  const now = new Date();
  const end = new Date(endDate);
  const diffTime = end - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
};

export const getPlanPrice = (planName, planType) => {
  return PLAN_CONFIG[planName]?.[planType]?.price || 0;
};

export const getPlanFeatures = (planName) => {
  return PLAN_CONFIG[planName]?.features || PLAN_CONFIG.free.features;
};

export const isPlanActive = (plan) => {
  if (!plan) return false;
  if (plan.status !== 'active') return false;
  return plan.daysRemaining > 0;
};

export const canUpgrade = (currentPlan, newPlan) => {
  const planHierarchy = ['free', 'basic', 'premium', 'enterprise'];
  const currentIndex = planHierarchy.indexOf(currentPlan);
  const newIndex = planHierarchy.indexOf(newPlan);
  return newIndex > currentIndex;
};

export const getUpgradePrice = (currentPlan, newPlan, planType) => {
  const currentPrice = getPlanPrice(currentPlan, planType);
  const newPrice = getPlanPrice(newPlan, planType);
  return Math.max(0, newPrice - currentPrice);
};

export default {
  providerPlanSchema,
  PLAN_CONFIG,
  calculateEndDate,
  calculateDaysRemaining,
  getPlanPrice,
  getPlanFeatures,
  isPlanActive,
  canUpgrade,
  getUpgradePrice
};
