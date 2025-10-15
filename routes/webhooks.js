import express from 'express';
import stripeService from '../services/stripeService.js';
import orderService from '../services/orderService.js';

const router = express.Router();

// Stripe webhook endpoint
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET not configured');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    // Construct the event
    const result = stripeService.constructWebhookEvent(req.body, signature, webhookSecret);
    
    if (!result.success) {
      console.error('Webhook signature verification failed:', result.error);
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = result.event;
    console.log('Received webhook event:', event.type, 'with ID:', event.id);

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object);
        break;
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({ error: 'Webhook handler failed' });
  }
});

// Handle successful checkout session
async function handleCheckoutSessionCompleted(session) {
  try {
    console.log('Processing checkout.session.completed:', session.id);
    
    // Check if this is an order payment
    if (session.metadata && session.metadata.type === 'order_payment') {
      const orderId = session.metadata.orderId;
      const customerId = session.metadata.customerId;
      
      console.log('Updating order payment status:', { orderId, customerId });
      
      // Update order payment status to paid
      await orderService.updatePaymentStatus(orderId, 'paid', customerId, 'client');
      
      // Also update order status to confirmed when payment is successful
      await orderService.updateOrderStatus(orderId, 'confirmed', customerId, 'client');
      
      console.log('Order payment status and order status updated successfully');
    } else {
      console.log('Non-order payment session, skipping order update');
    }
  } catch (error) {
    console.error('Error handling checkout session completed:', error);
  }
}

// Handle successful payment intent
async function handlePaymentIntentSucceeded(paymentIntent) {
  try {
    console.log('Processing payment_intent.succeeded:', paymentIntent.id);
    
    // Check if this is an order payment
    if (paymentIntent.metadata && paymentIntent.metadata.type === 'order_payment') {
      const orderId = paymentIntent.metadata.orderId;
      const customerId = paymentIntent.metadata.customerId;
      
      console.log('Updating order payment status from payment intent:', { orderId, customerId });
      
      // Update order payment status to paid
      await orderService.updatePaymentStatus(orderId, 'paid', customerId, 'client');
      
      // Also update order status to confirmed when payment is successful
      await orderService.updateOrderStatus(orderId, 'confirmed', customerId, 'client');
      
      console.log('Order payment status and order status updated successfully from payment intent');
    }
  } catch (error) {
    console.error('Error handling payment intent succeeded:', error);
  }
}

// Handle failed payment intent
async function handlePaymentIntentFailed(paymentIntent) {
  try {
    console.log('Processing payment_intent.payment_failed:', paymentIntent.id);
    
    // Check if this is an order payment
    if (paymentIntent.metadata && paymentIntent.metadata.type === 'order_payment') {
      const orderId = paymentIntent.metadata.orderId;
      const customerId = paymentIntent.metadata.customerId;
      
      console.log('Updating order payment status to failed:', { orderId, customerId });
      
      // Update order payment status to failed
      await orderService.updatePaymentStatus(orderId, 'failed', customerId, 'client');
      
      console.log('Order payment status updated to failed');
    }
  } catch (error) {
    console.error('Error handling payment intent failed:', error);
  }
}

export default router;
