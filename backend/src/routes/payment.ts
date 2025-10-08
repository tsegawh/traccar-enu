import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import {
  createTelebirrPayment,
  verifyTelebirrCallback,
  TelebirrPaymentRequest
} from '../services/payment';
import {
  createStripeEmbeddedCheckout,
  createStripeCheckout,
  verifyStripeWebhook,
  StripeEmbeddedCheckoutRequest,
  StripeCheckoutRequest
} from '../services/stripePayment';
import { InvoiceGenerator } from '../services/invoiceGenerator';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * Telebirr Payment Flow:
 * 1. Frontend sends payment request with planId
 * 2. Backend creates payment record and calls Telebirr API
 * 3. Telebirr returns prepay_id and checkout URL
 * 4. Frontend redirects user to Telebirr checkout
 * 5. User completes payment on Telebirr
 * 6. Telebirr calls our callback endpoint
 * 7. We verify signature and update subscription
 */

// Initiate payment
router.post('/pay', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { planId, orderType = 'SUBSCRIPTION', subType, metadata, paymentGateway = 'stripe', useEmbedded = true } = req.body;
    const userId = req.user!.id;

    if (!planId) {
      throw createError('Plan ID is required', 400);
    }

    if (!['stripe', 'telebirr'].includes(paymentGateway)) {
      throw createError('Invalid payment gateway. Must be "stripe" or "telebirr"', 400);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw createError('User not found', 404);
    }

    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId }
    });

    if (!plan) {
      throw createError('Subscription plan not found', 404);
    }

    if (plan.price === 0) {
      throw createError('Cannot process payment for free plan', 400);
    }

    const orderId = `ORDER_${Date.now()}_${userId.slice(-6)}`;
    const invoiceNumber = await InvoiceGenerator.generateInvoiceNumber();
    const description = InvoiceGenerator.generateOrderDescription(
      orderType,
      subType,
      { ...metadata, planName: plan.name }
    );

    const payment = await prisma.payment.create({
      data: {
        userId,
        orderId,
        invoiceNumber,
        orderType,
        subType,
        amount: plan.price,
        description,
        paymentMethod: paymentGateway.toUpperCase(),
        metadata: JSON.stringify({ ...metadata, planName: plan.name, planId }),
        status: 'PENDING',
      }
    });

    const returnUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment/success?orderId=${orderId}`;
    const cancelUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment/cancel?orderId=${orderId}`;

    if (paymentGateway === 'stripe') {
      if (useEmbedded) {
        const stripeRequest: StripeEmbeddedCheckoutRequest = {
          orderId,
          amount: plan.price,
          currency: 'USD',
          planName: plan.name,
          userEmail: user.email,
          userId,
          planId,
          returnUrl,
        };

        const stripeResponse = await createStripeEmbeddedCheckout(stripeRequest);

        await prisma.payment.update({
          where: { id: payment.id },
          data: { prepayId: stripeResponse.sessionId }
        });

        res.json({
          success: true,
          gateway: 'stripe',
          embedded: true,
          orderId,
          invoiceNumber,
          clientSecret: stripeResponse.clientSecret,
          sessionId: stripeResponse.sessionId,
        });
      } else {
        const stripeRequest: StripeCheckoutRequest = {
          orderId,
          amount: plan.price,
          currency: 'USD',
          planName: plan.name,
          userEmail: user.email,
          userId,
          planId,
          successUrl: returnUrl,
          cancelUrl,
        };

        const stripeResponse = await createStripeCheckout(stripeRequest);

        await prisma.payment.update({
          where: { id: payment.id },
          data: { prepayId: stripeResponse.sessionId }
        });

        res.json({
          success: true,
          gateway: 'stripe',
          embedded: false,
          orderId,
          invoiceNumber,
          checkoutUrl: stripeResponse.checkoutUrl,
          sessionId: stripeResponse.sessionId,
        });
      }
    } else {
      const telebirrRequest: TelebirrPaymentRequest = {
        orderId,
        amount: plan.price,
        userId,
        planId,
        returnUrl,
        cancelUrl,
      };

      const telebirrResponse = await createTelebirrPayment(telebirrRequest);

      await prisma.payment.update({
        where: { id: payment.id },
        data: { prepayId: telebirrResponse.prepay_id }
      });

      res.json({
        success: true,
        gateway: 'telebirr',
        orderId,
        invoiceNumber,
        checkoutUrl: telebirrResponse.checkout_url,
        prepayId: telebirrResponse.prepay_id,
      });
    }

  } catch (error) {
    next(error);
  }
});

// Stripe webhook handler
router.post('/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res, next) => {
  try {
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    const event = verifyStripeWebhook(req.body, signature);
    console.log('📞 Stripe webhook received:', event.type);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any;
      const orderId = session.client_reference_id || session.metadata?.orderId;

      if (!orderId) {
        console.error('❌ No orderId in session');
        return res.status(400).json({ error: 'Missing orderId' });
      }

      const payment = await prisma.payment.findUnique({
        where: { orderId },
        include: { user: true }
      });

      if (!payment) {
        console.error('❌ Payment not found:', orderId);
        return res.status(404).json({ error: 'Payment not found' });
      }

      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'COMPLETED',
          telebirrTxId: session.payment_intent,
        }
      });

      console.log('✅ Payment successful, updating subscription');

      let planId = session.metadata?.planId;
      if (!planId && payment.metadata) {
        try {
          const metadata = typeof payment.metadata === 'string'
            ? JSON.parse(payment.metadata)
            : payment.metadata;
          planId = metadata.planId;
        } catch (e) {
          console.error('Error parsing metadata:', e);
        }
      }

      if (planId) {
        const plan = await prisma.subscriptionPlan.findUnique({
          where: { id: planId }
        });

        if (plan) {
          const endDate = new Date();
          endDate.setDate(endDate.getDate() + plan.durationDays);

          await prisma.subscription.upsert({
            where: { userId: payment.userId },
            update: {
              planId: plan.id,
              status: 'ACTIVE',
              endDate,
            },
            create: {
              userId: payment.userId,
              planId: plan.id,
              status: 'ACTIVE',
              endDate,
            }
          });

          console.log('✅ Subscription updated successfully');
        }
      }
    } else if (event.type === 'checkout.session.expired') {
      const session = event.data.object as any;
      const orderId = session.client_reference_id || session.metadata?.orderId;

      if (orderId) {
        await prisma.payment.updateMany({
          where: { orderId, status: 'PENDING' },
          data: { status: 'CANCELLED' }
        });
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('❌ Stripe webhook error:', error);
    next(error);
  }
});

// Telebirr payment callback
router.post('/callback/telebirr', async (req, res, next) => {
  try {
    console.log('📞 Telebirr callback received:', req.body);

    // Verify Telebirr signature
    const isValid = await verifyTelebirrCallback(req.body);
    
    if (!isValid) {
      console.error('❌ Invalid Telebirr signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const { 
      out_trade_no: orderId, 
      trade_status, 
      transaction_id,
      total_amount 
    } = req.body;

    // Find payment record
    const payment = await prisma.payment.findUnique({
      where: { orderId },
      include: { user: true }
    });

    if (!payment) {
      console.error('❌ Payment not found:', orderId);
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Update payment status
    const paymentStatus = trade_status === 'TRADE_SUCCESS' ? 'COMPLETED' : 'FAILED';
    
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: paymentStatus,
        telebirrTxId: transaction_id,
      }
    });

    // If payment successful, update user subscription
    if (trade_status === 'TRADE_SUCCESS') {
      console.log('✅ Payment successful, updating subscription');

      // Get the plan from the payment amount (you might want to store planId in payment)
      const plan = await prisma.subscriptionPlan.findFirst({
        where: { price: parseFloat(total_amount) }
      });

      if (plan) {
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + plan.durationDays);

        // Update or create subscription
        await prisma.subscription.upsert({
          where: { userId: payment.userId },
          update: {
            planId: plan.id,
            status: 'ACTIVE',
            endDate,
          },
          create: {
            userId: payment.userId,
            planId: plan.id,
            status: 'ACTIVE',
            endDate,
          }
        });

        console.log('✅ Subscription updated successfully');
      }
    }

    res.json({ success: true });

  } catch (error) {
    console.error('❌ Callback error:', error);
    next(error);
  }
});

// Get payment history
router.get('/history', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const payments = await prisma.payment.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({ payments });
  } catch (error) {
    next(error);
  }
});

// Get payment status
router.get('/status/:orderId', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { orderId } = req.params;

    const payment = await prisma.payment.findFirst({
      where: { 
        orderId,
        userId: req.user!.id 
      }
    });

    if (!payment) {
      throw createError('Payment not found', 404);
    }

    res.json({ payment });
  } catch (error) {
    next(error);
  }
});

export default router;