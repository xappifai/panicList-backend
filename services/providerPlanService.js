import { adminDb } from '../config/firebase-admin.js';
import { 
  providerPlanSchema, 
  calculateEndDate, 
  calculateDaysRemaining, 
  getPlanPrice, 
  getPlanFeatures,
  isPlanActive,
  canUpgrade,
  getUpgradePrice
} from '../models/ProviderPlan.js';

// Create or update provider plan
export const createOrUpdateProviderPlan = async (providerId, planData) => {
  try {
    // Validate plan data
    const { error, value } = providerPlanSchema.validate(planData);
    if (error) {
      return { success: false, error: error.details[0].message };
    }

    const planRef = adminDb.collection('providerPlans').doc(providerId);
    const planDoc = await planRef.get();

    if (planDoc.exists) {
      // Update existing plan
      await planRef.update({
        ...value,
        updatedAt: new Date()
      });
    } else {
      // Create new plan
      await planRef.set({
        ...value,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    return { success: true, planId: providerId };
  } catch (error) {
    console.error('Error creating/updating provider plan:', error);
    return { success: false, error: error.message };
  }
};

// Get provider plan
export const getProviderPlan = async (providerId) => {
  try {
    const planRef = adminDb.collection('providerPlans').doc(providerId);
    const planDoc = await planRef.get();

    if (!planDoc.exists) {
      return { success: false, error: 'Plan not found' };
    }

    const planData = planDoc.data();
    
    // Calculate days remaining
    const daysRemaining = calculateDaysRemaining(planData.endDate);
    
    // Update days remaining in database if it has changed
    if (daysRemaining !== planData.daysRemaining) {
      await planRef.update({ 
        daysRemaining,
        updatedAt: new Date()
      });
      planData.daysRemaining = daysRemaining;
    }

    return { success: true, plan: planData };
  } catch (error) {
    console.error('Error getting provider plan:', error);
    return { success: false, error: error.message };
  }
};

// Activate provider plan
export const activateProviderPlan = async (providerId, planName, planType, paymentData = {}) => {
  try {
    const endDate = calculateEndDate(planType);
    const daysRemaining = calculateDaysRemaining(endDate);
    const price = getPlanPrice(planName, planType);
    const features = getPlanFeatures(planName);

    const planData = {
      providerId,
      planName,
      planType,
      status: 'active',
      startDate: new Date(),
      endDate,
      daysRemaining,
      price,
      currency: 'usd',
      features,
      autoRenew: planType === 'monthly',
      stripeSubscriptionId: paymentData.stripeSubscriptionId || null,
      stripeCustomerId: paymentData.stripeCustomerId || null,
      stripePaymentIntentId: paymentData.stripePaymentIntentId || null
    };

    const result = await createOrUpdateProviderPlan(providerId, planData);
    
    if (result.success) {
      // Update provider's plan status in users collection
      await adminDb.collection('users').doc(providerId).update({
        'providerInfo.plan': {
          name: planName,
          type: planType,
          status: 'active',
          endDate,
          daysRemaining
        },
        // Also store planType at root level for easy reads on client
        planType: planType,
        planName: planName,
        updatedAt: new Date()
      });
    }

    return result;
  } catch (error) {
    console.error('Error activating provider plan:', error);
    return { success: false, error: error.message };
  }
};

// Upgrade provider plan
export const upgradeProviderPlan = async (providerId, newPlanName, newPlanType) => {
  try {
    const currentPlan = await getProviderPlan(providerId);
    
    if (!currentPlan.success) {
      return { success: false, error: 'Current plan not found' };
    }

    const currentPlanData = currentPlan.plan;
    
    if (!canUpgrade(currentPlanData.planName, newPlanName)) {
      return { success: false, error: 'Cannot downgrade plan' };
    }

    const upgradePrice = getUpgradePrice(currentPlanData.planName, newPlanName, newPlanType);
    
    // Calculate new end date based on remaining days
    const remainingDays = currentPlanData.daysRemaining;
    const newEndDate = new Date();
    newEndDate.setDate(newEndDate.getDate() + remainingDays + (newPlanType === 'monthly' ? 30 : 365));

    const newPlanData = {
      providerId,
      planName: newPlanName,
      planType: newPlanType,
      status: 'active',
      startDate: new Date(),
      endDate: newEndDate,
      daysRemaining: remainingDays + (newPlanType === 'monthly' ? 30 : 365),
      price: getPlanPrice(newPlanName, newPlanType),
      currency: 'usd',
      features: getPlanFeatures(newPlanName),
      autoRenew: newPlanType === 'monthly',
      upgradePrice,
      previousPlan: currentPlanData.planName
    };

    const result = await createOrUpdateProviderPlan(providerId, newPlanData);
    
    if (result.success) {
      // Update provider's plan status in users collection
      await adminDb.collection('users').doc(providerId).update({
        'providerInfo.plan': {
          name: newPlanName,
          type: newPlanType,
          status: 'active',
          endDate: newEndDate,
          daysRemaining: newPlanData.daysRemaining
        },
        planType: newPlanType,
        planName: newPlanName,
        updatedAt: new Date()
      });
    }

    return result;
  } catch (error) {
    console.error('Error upgrading provider plan:', error);
    return { success: false, error: error.message };
  }
};

// Cancel provider plan
export const cancelProviderPlan = async (providerId) => {
  try {
    const planRef = adminDb.collection('providerPlans').doc(providerId);
    await planRef.update({
      status: 'cancelled',
      autoRenew: false,
      updatedAt: new Date()
    });

    // Update provider's plan status in users collection
    await adminDb.collection('users').doc(providerId).update({
      'providerInfo.plan.status': 'cancelled',
      updatedAt: new Date()
    });

    return { success: true };
  } catch (error) {
    console.error('Error cancelling provider plan:', error);
    return { success: false, error: error.message };
  }
};

// Check plan expiration and update status
export const checkAndUpdatePlanExpiration = async (providerId) => {
  try {
    const planResult = await getProviderPlan(providerId);
    
    if (!planResult.success) {
      return { success: false, error: 'Plan not found' };
    }

    const plan = planResult.plan;
    
    if (plan.daysRemaining <= 0 && plan.status === 'active') {
      // Plan has expired
      await adminDb.collection('providerPlans').doc(providerId).update({
        status: 'expired',
        updatedAt: new Date()
      });

      // Update provider's plan status in users collection
      await adminDb.collection('users').doc(providerId).update({
        'providerInfo.plan.status': 'expired',
        updatedAt: new Date()
      });

      return { success: true, expired: true };
    }

    return { success: true, expired: false };
  } catch (error) {
    console.error('Error checking plan expiration:', error);
    return { success: false, error: error.message };
  }
};

// Get all expired plans
export const getExpiredPlans = async () => {
  try {
    const expiredPlans = await adminDb.collection('providerPlans')
      .where('status', '==', 'active')
      .where('daysRemaining', '<=', 0)
      .get();

    const plans = [];
    expiredPlans.forEach(doc => {
      plans.push({ id: doc.id, ...doc.data() });
    });

    return { success: true, plans };
  } catch (error) {
    console.error('Error getting expired plans:', error);
    return { success: false, error: error.message };
  }
};

// Renew plan
export const renewPlan = async (providerId, planName, planType) => {
  try {
    const endDate = calculateEndDate(planType);
    const daysRemaining = calculateDaysRemaining(endDate);
    const price = getPlanPrice(planName, planType);
    const features = getPlanFeatures(planName);

    const planData = {
      providerId,
      planName,
      planType,
      status: 'active',
      startDate: new Date(),
      endDate,
      daysRemaining,
      price,
      currency: 'usd',
      features,
      autoRenew: planType === 'monthly',
      renewedAt: new Date()
    };

    const result = await createOrUpdateProviderPlan(providerId, planData);
    
    if (result.success) {
      // Update provider's plan status in users collection
      await adminDb.collection('users').doc(providerId).update({
        'providerInfo.plan': {
          name: planName,
          type: planType,
          status: 'active',
          endDate,
          daysRemaining
        },
        planType: planType,
        planName: planName,
        updatedAt: new Date()
      });
    }

    return result;
  } catch (error) {
    console.error('Error renewing plan:', error);
    return { success: false, error: error.message };
  }
};

// Get plan statistics
export const getPlanStatistics = async () => {
  try {
    const plansSnapshot = await adminDb.collection('providerPlans').get();
    const stats = {
      total: 0,
      active: 0,
      expired: 0,
      cancelled: 0,
      byPlan: {
        free: 0,
        basic: 0,
        premium: 0,
        enterprise: 0
      }
    };

    plansSnapshot.forEach(doc => {
      const plan = doc.data();
      stats.total++;
      
      if (plan.status === 'active') stats.active++;
      else if (plan.status === 'expired') stats.expired++;
      else if (plan.status === 'cancelled') stats.cancelled++;
      
      if (plan.planName in stats.byPlan) {
        stats.byPlan[plan.planName]++;
      }
    });

    return { success: true, statistics: stats };
  } catch (error) {
    console.error('Error getting plan statistics:', error);
    return { success: false, error: error.message };
  }
};

export default {
  createOrUpdateProviderPlan,
  getProviderPlan,
  activateProviderPlan,
  upgradeProviderPlan,
  cancelProviderPlan,
  checkAndUpdatePlanExpiration,
  getExpiredPlans,
  renewPlan,
  getPlanStatistics
};
