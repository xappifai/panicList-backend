import express from 'express';
import { verifyToken, requireProvider } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import Joi from 'joi';
import stripeService from '../services/stripeService.js';
import providerPlanService from '../services/providerPlanService.js';
import firestoreService from '../services/firestoreService.js';

const router = express.Router();

// Validation schemas
const createCheckoutSchema = Joi.object({
  planName: Joi.string().valid('free', 'basic', 'premium', 'enterprise').required(),
  planType: Joi.string().valid('monthly', 'yearly').required(),
  successUrl: Joi.string().pattern(/^https?:\/\/.+/).required().messages({
    'string.pattern.base': 'Success URL must be a valid HTTP/HTTPS URL'
  }),
  cancelUrl: Joi.string().pattern(/^https?:\/\/.+/).required().messages({
    'string.pattern.base': 'Cancel URL must be a valid HTTP/HTTPS URL'
  })
});

const webhookSchema = Joi.object({
  type: Joi.string().required(),
  data: Joi.object().required()
});

const paymentSuccessSchema = Joi.object({
  stripeSessionId: Joi.string().optional(),
  paymentIntentId: Joi.string().optional(),
  planName: Joi.string().valid('free', 'basic', 'premium', 'enterprise').optional(),
  planType: Joi.string().valid('monthly', 'yearly').optional()
}).custom((value, helpers) => {
  // At least one of stripeSessionId or paymentIntentId must be provided
  if (!value.stripeSessionId && !value.paymentIntentId) {
    return helpers.error('any.custom', { message: 'Either stripeSessionId or paymentIntentId must be provided' });
  }
  return value;
});

// Create Stripe customer
router.post('/create-customer', verifyToken, async (req, res) => {
  try {
    const { email, name } = req.user;
    const metadata = {
      userId: req.user.uid,
      userType: req.user.userType
    };

    const result = await stripeService.createCustomer(email, name, metadata);
    
    if (result.success) {
      // Save customer ID to user profile
      await firestoreService.updateDocument('users', req.user.uid, {
        stripeCustomerId: result.customer.id
      });
      
      res.json({
        success: true,
        customer: result.customer
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error creating customer:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create customer'
    });
  }
});

// Create checkout session
router.post('/create-checkout', verifyToken, validate(createCheckoutSchema), async (req, res) => {
  try {
    const { planName, planType, successUrl, cancelUrl } = req.body;
    const userId = req.user.uid;

    // Check if user already has a Stripe customer ID
    let customerId = req.user.stripeCustomerId;
    
    if (!customerId) {
      // Create customer if doesn't exist
      const customerResult = await stripeService.createCustomer(
        req.user.email, 
        req.user.fullName, 
        { userId, userType: req.user.userType }
      );
      
      if (!customerResult.success) {
        return res.status(400).json({
          success: false,
          error: customerResult.error
        });
      }
      
      customerId = customerResult.customer.id;
      
      // Save customer ID to user profile
      await firestoreService.updateDocument('users', userId, {
        stripeCustomerId: customerId
      });
    }

    // Handle free plan
    if (planName === 'free') {
      // Activate free plan directly
      const planResult = await providerPlanService.activateProviderPlan(
        userId, 
        planName, 
        planType
      );
      
      if (planResult.success) {
        return res.json({
          success: true,
          freePlan: true,
          message: 'Free plan activated successfully',
          plan: planResult.plan
        });
      } else {
        return res.status(400).json({
          success: false,
          error: planResult.error
        });
      }
    }

    // Create checkout session for paid plans
    const sessionResult = await stripeService.createCheckoutSession(
      customerId,
      planName,
      planType,
      successUrl,
      cancelUrl,
      {
        userId,
        userType: req.user.userType
      }
    );

    if (sessionResult.success) {
      res.json({
        success: true,
        sessionId: sessionResult.session.id,
        sessionUrl: sessionResult.session.url
      });
    } else {
      res.status(400).json({
        success: false,
        error: sessionResult.error
      });
    }
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create checkout session'
    });
  }
});

// Handle successful payment
router.post('/payment-success', verifyToken, validate(paymentSuccessSchema), async (req, res) => {
  try {
    console.log('Payment success request body:', JSON.stringify(req.body, null, 2));
    console.log('Request headers:', req.headers);
    const { stripeSessionId, paymentIntentId } = req.body;
    const userId = req.user.uid;

    let paymentData = {};
    
    if (stripeSessionId) {
      // Handle checkout session success
      console.log('Retrieving Stripe session:', stripeSessionId);
      const session = await stripeService.retrieveSession(stripeSessionId);
      console.log('Stripe session result:', session);
      if (session.success) {
        paymentData = {
          stripePaymentIntentId: session.session.payment_intent,
          stripeCustomerId: session.session.customer,
          stripeSubscriptionId: session.session.subscription || null
        };
      } else {
        console.log('Stripe session retrieval failed:', session.error);
        return res.status(400).json({
          success: false,
          error: session.error || 'Failed to retrieve payment session'
        });
      }
    } else if (paymentIntentId) {
      // Handle direct payment intent
      const paymentIntent = await stripeService.retrievePaymentIntent(paymentIntentId);
      if (paymentIntent.success) {
        paymentData = {
          stripePaymentIntentId: paymentIntentId,
          stripeCustomerId: paymentIntent.paymentIntent.customer
        };
      }
    }

    // Extract plan information from Stripe session metadata
    let planName = 'basic';
    let planType = 'monthly';
    
    if (stripeSessionId) {
      const session = await stripeService.retrieveSession(stripeSessionId);
    if (session.success && session.session.metadata) {
        planName = session.session.metadata.planName || 'basic';
        planType = session.session.metadata.planType || 'monthly';
      }
    }

    // Activate the plan
    console.log('Activating plan for user:', userId, 'Plan:', planName, planType);
    console.log('Payment data:', paymentData);
    const planResult = await providerPlanService.activateProviderPlan(
      userId,
      planName,
      planType,
      paymentData
    );
    console.log('Plan activation result:', planResult);

    if (planResult.success) {
      res.json({
        success: true,
        message: 'Plan activated successfully',
        plan: planResult.plan
      });
    } else {
      console.log('Plan activation failed:', planResult.error);
      res.status(400).json({
        success: false,
        error: planResult.error
      });
    }
  } catch (error) {
    console.error('Error handling payment success:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to activate plan'
    });
  }
});

// Get user's current plan
router.get('/current-plan', verifyToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const planResult = await providerPlanService.getProviderPlan(userId);
    
    if (planResult.success) {
      res.json({
        success: true,
        plan: planResult.plan
      });
    } else {
      res.status(404).json({
        success: false,
        error: planResult.error
      });
    }
  } catch (error) {
    console.error('Error getting current plan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get current plan'
    });
  }
});

// Upgrade plan
router.post('/upgrade-plan', verifyToken, async (req, res) => {
  try {
    const { newPlanName, newPlanType } = req.body;
    const userId = req.user.uid;

    const upgradeResult = await providerPlanService.upgradeProviderPlan(
      userId,
      newPlanName,
      newPlanType
    );

    if (upgradeResult.success) {
      res.json({
        success: true,
        message: 'Plan upgraded successfully',
        plan: upgradeResult.plan
      });
    } else {
      res.status(400).json({
        success: false,
        error: upgradeResult.error
      });
    }
  } catch (error) {
    console.error('Error upgrading plan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upgrade plan'
    });
  }
});

// Cancel plan
router.post('/cancel-plan', verifyToken, async (req, res) => {
  try {
    const userId = req.user.uid;
    const cancelResult = await providerPlanService.cancelProviderPlan(userId);

    if (cancelResult.success) {
      res.json({
        success: true,
        message: 'Plan cancelled successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: cancelResult.error
      });
    }
  } catch (error) {
    console.error('Error cancelling plan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel plan'
    });
  }
});

// Get saved payment methods for current user (cards)
router.get('/payment-methods', verifyToken, async (req, res) => {
  try {
    let customerId = req.user.stripeCustomerId;
    if (!customerId) {
      // Create customer if doesn't exist
      const customerResult = await stripeService.createCustomer(
        req.user.email,
        req.user.fullName,
        { userId: req.user.uid, userType: req.user.userType }
      );
      if (!customerResult.success) {
        return res.status(400).json({ success: false, error: customerResult.error });
      }
      customerId = customerResult.customer.id;
      await firestoreService.updateDocument('users', req.user.uid, { stripeCustomerId: customerId });
    }

    const pmResult = await stripeService.getCustomerPaymentMethods(customerId);
    if (!pmResult.success) {
      return res.status(400).json({ success: false, error: pmResult.error });
    }
    res.json({ success: true, paymentMethods: pmResult.paymentMethods?.data || [] });
  } catch (error) {
    console.error('Error getting payment methods:', error);
    res.status(500).json({ success: false, error: 'Failed to get payment methods' });
  }
});

// Stripe webhook handler
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    const eventResult = stripeService.constructWebhookEvent(req.body, sig, endpointSecret);
    
    if (!eventResult.success) {
      return res.status(400).send(`Webhook signature verification failed: ${eventResult.error}`);
    }

    const event = eventResult.event;

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        await handleCheckoutSessionCompleted(session);
        break;
        
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        await handlePaymentIntentSucceeded(paymentIntent);
        break;
        
      case 'invoice.payment_succeeded':
        const invoice = event.data.object;
        await handleInvoicePaymentSucceeded(invoice);
        break;
        
      case 'customer.subscription.updated':
        const subscription = event.data.object;
        await handleSubscriptionUpdated(subscription);
        break;
        
      case 'customer.subscription.deleted':
        const deletedSubscription = event.data.object;
        await handleSubscriptionDeleted(deletedSubscription);
        break;
        
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).send(`Webhook error: ${error.message}`);
  }
});

// Webhook event handlers
async function handleCheckoutSessionCompleted(session) {
  try {
    const { userId, planName, planType } = session.metadata;
    
    if (userId && planName && planType) {
      const paymentData = {
        stripeSessionId: session.id,
        stripePaymentIntentId: session.payment_intent,
        stripeCustomerId: session.customer
      };

      await providerPlanService.activateProviderPlan(userId, planName, planType, paymentData);
    }
  } catch (error) {
    console.error('Error handling checkout session completed:', error);
  }
}

async function handlePaymentIntentSucceeded(paymentIntent) {
  try {
    const { userId, planName, planType } = paymentIntent.metadata;
    
    if (userId && planName && planType) {
      const paymentData = {
        stripePaymentIntentId: paymentIntent.id,
        stripeCustomerId: paymentIntent.customer
      };

      await providerPlanService.activateProviderPlan(userId, planName, planType, paymentData);
    }
  } catch (error) {
    console.error('Error handling payment intent succeeded:', error);
  }
}

async function handleInvoicePaymentSucceeded(invoice) {
  try {
    // Handle subscription renewal
    if (invoice.subscription) {
      const subscription = await stripeService.retrieveSubscription(invoice.subscription);
      if (subscription.success) {
        const { userId, planName, planType } = subscription.subscription.metadata;
        
        if (userId && planName && planType) {
          await providerPlanService.renewPlan(userId, planName, planType);
        }
      }
    }
  } catch (error) {
    console.error('Error handling invoice payment succeeded:', error);
  }
}

async function handleSubscriptionUpdated(subscription) {
  try {
    const { userId } = subscription.metadata;
    
    if (userId) {
      // Update subscription status in database
      await firestoreService.updateDocument('users', userId, {
        'providerInfo.subscriptionStatus': subscription.status,
        updatedAt: new Date()
      });
    }
  } catch (error) {
    console.error('Error handling subscription updated:', error);
  }
}

async function handleSubscriptionDeleted(subscription) {
  try {
    const { userId } = subscription.metadata;
    
    if (userId) {
      await providerPlanService.cancelProviderPlan(userId);
    }
  } catch (error) {
    console.error('Error handling subscription deleted:', error);
  }
}

export default router;
