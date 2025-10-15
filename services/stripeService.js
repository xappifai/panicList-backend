import Stripe from 'stripe';
import { PLAN_CONFIG, getPlanPrice } from '../models/ProviderPlan.js';

// Initialize Stripe lazily
let stripe = null;

const getStripeInstance = () => {
  if (!stripe && process.env.STRIPE_SECRET_KEY) {
    console.log('Initializing Stripe with key length:', process.env.STRIPE_SECRET_KEY.length);
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripe;
};

// Create Stripe customer
export const createCustomer = async (email, name, metadata = {}) => {
  const stripeInstance = getStripeInstance();
  if (!stripeInstance) {
    return { success: false, error: 'Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.' };
  }
  
  try {
    const customer = await stripeInstance.customers.create({
      email,
      name,
      metadata
    });
    return { success: true, customer };
  } catch (error) {
    console.error('Error creating Stripe customer:', error);
    return { success: false, error: error.message };
  }
};

// Create payment intent for one-time payment
export const createPaymentIntent = async (amount, currency, customerId, metadata = {}) => {
  const stripeInstance = getStripeInstance();
  if (!stripeInstance) {
    return { success: false, error: 'Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.' };
  }
  
  try {
    const paymentIntent = await stripeInstance.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      customer: customerId,
      metadata,
      automatic_payment_methods: {
        enabled: true,
      },
    });
    return { success: true, paymentIntent };
  } catch (error) {
    console.error('Error creating payment intent:', error);
    return { success: false, error: error.message };
  }
};

// Create subscription for recurring payments
export const createSubscription = async (customerId, priceId, metadata = {}) => {
  const stripeInstance = getStripeInstance();
  if (!stripeInstance) {
    return { success: false, error: 'Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.' };
  }
  
  try {
    const subscription = await stripeInstance.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      metadata,
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
    });
    return { success: true, subscription };
  } catch (error) {
    console.error('Error creating subscription:', error);
    return { success: false, error: error.message };
  }
};

// Create checkout session for order payment
export const createOrderCheckoutSession = async (sessionData) => {
  const stripeInstance = getStripeInstance();
  if (!stripeInstance) {
    return { success: false, error: 'Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.' };
  }
  
  try {
    const session = await stripeInstance.checkout.sessions.create(sessionData);
    return { success: true, session };
  } catch (error) {
    console.error('Error creating order checkout session:', error);
    return { success: false, error: error.message };
  }
};

// Create checkout session for subscription plans
export const createCheckoutSession = async (customerId, planName, planType, successUrl, cancelUrl, metadata = {}) => {
  const stripeInstance = getStripeInstance();
  if (!stripeInstance) {
    return { success: false, error: 'Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.' };
  }
  
  try {
    const price = getPlanPrice(planName, planType);
    
    if (price === 0) {
      return { success: false, error: 'Free plans do not require payment' };
    }

    const session = await stripeInstance.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${PLAN_CONFIG[planName].name} Plan (${planType})`,
              description: `Access to ${PLAN_CONFIG[planName].name} features for ${planType === 'monthly' ? '1 month' : '1 year'}`,
            },
            unit_amount: Math.round(price * 100), // Convert to cents
            recurring: planType === 'monthly' ? { interval: 'month' } : { interval: 'year' },
          },
          quantity: 1,
        },
      ],
      mode: planType === 'monthly' ? 'subscription' : 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        planName,
        planType,
        ...metadata
      },
    });

    return { success: true, session };
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return { success: false, error: error.message };
  }
};

// Retrieve payment intent
export const retrievePaymentIntent = async (paymentIntentId) => {
  const stripeInstance = getStripeInstance();
  if (!stripeInstance) {
    return { success: false, error: 'Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.' };
  }
  
  try {
    const paymentIntent = await stripeInstance.paymentIntents.retrieve(paymentIntentId);
    return { success: true, paymentIntent };
  } catch (error) {
    console.error('Error retrieving payment intent:', error);
    return { success: false, error: error.message };
  }
};

// Retrieve subscription
export const retrieveSubscription = async (subscriptionId) => {
  const stripeInstance = getStripeInstance();
  if (!stripeInstance) {
    return { success: false, error: 'Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.' };
  }
  
  try {
    const subscription = await stripeInstance.subscriptions.retrieve(subscriptionId);
    return { success: true, subscription };
  } catch (error) {
    console.error('Error retrieving subscription:', error);
    return { success: false, error: error.message };
  }
};

// Retrieve checkout session
export const retrieveSession = async (sessionId) => {
  const stripeInstance = getStripeInstance();
  if (!stripeInstance) {
    return { success: false, error: 'Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.' };
  }
  
  try {
    const session = await stripeInstance.checkout.sessions.retrieve(sessionId);
    return { success: true, session };
  } catch (error) {
    console.error('Error retrieving session:', error);
    return { success: false, error: error.message };
  }
};

// Cancel subscription
export const cancelSubscription = async (subscriptionId) => {
  const stripeInstance = getStripeInstance();
  if (!stripeInstance) {
    return { success: false, error: 'Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.' };
  }
  
  try {
    const subscription = await stripeInstance.subscriptions.cancel(subscriptionId);
    return { success: true, subscription };
  } catch (error) {
    console.error('Error canceling subscription:', error);
    return { success: false, error: error.message };
  }
};

// Update subscription
export const updateSubscription = async (subscriptionId, newPriceId) => {
  const stripeInstance = getStripeInstance();
  if (!stripeInstance) {
    return { success: false, error: 'Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.' };
  }
  
  try {
    const subscription = await stripeInstance.subscriptions.retrieve(subscriptionId);
    const updatedSubscription = await stripeInstance.subscriptions.update(subscriptionId, {
      items: [{
        id: subscription.items.data[0].id,
        price: newPriceId,
      }],
      proration_behavior: 'create_prorations',
    });
    return { success: true, subscription: updatedSubscription };
  } catch (error) {
    console.error('Error updating subscription:', error);
    return { success: false, error: error.message };
  }
};

// Create webhook endpoint
export const constructWebhookEvent = (payload, signature, secret) => {
  const stripeInstance = getStripeInstance();
  if (!stripeInstance) {
    return { success: false, error: 'Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.' };
  }
  
  try {
    const event = stripeInstance.webhooks.constructEvent(payload, signature, secret);
    return { success: true, event };
  } catch (error) {
    console.error('Error constructing webhook event:', error);
    return { success: false, error: error.message };
  }
};

// Handle successful payment
export const handleSuccessfulPayment = async (paymentIntent) => {
  try {
    const { planName, planType, providerId } = paymentIntent.metadata;
    
    // Here you would update the provider's plan in your database
    // This will be handled by the webhook handler
    
    return { success: true, paymentIntent };
  } catch (error) {
    console.error('Error handling successful payment:', error);
    return { success: false, error: error.message };
  }
};

// Get customer's payment methods
export const getCustomerPaymentMethods = async (customerId) => {
  const stripeInstance = getStripeInstance();
  if (!stripeInstance) {
    return { success: false, error: 'Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.' };
  }
  
  try {
    const paymentMethods = await stripeInstance.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });
    return { success: true, paymentMethods };
  } catch (error) {
    console.error('Error getting payment methods:', error);
    return { success: false, error: error.message };
  }
};

// Create setup intent for saving payment method
export const createSetupIntent = async (customerId) => {
  const stripeInstance = getStripeInstance();
  if (!stripeInstance) {
    return { success: false, error: 'Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.' };
  }
  
  try {
    const setupIntent = await stripeInstance.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
    });
    return { success: true, setupIntent };
  } catch (error) {
    console.error('Error creating setup intent:', error);
    return { success: false, error: error.message };
  }
};

export default {
  createCustomer,
  createPaymentIntent,
  createSubscription,
  createCheckoutSession,
  createOrderCheckoutSession,
  retrievePaymentIntent,
  retrieveSubscription,
  retrieveSession,
  cancelSubscription,
  updateSubscription,
  constructWebhookEvent,
  handleSuccessfulPayment,
  getCustomerPaymentMethods,
  createSetupIntent
};
