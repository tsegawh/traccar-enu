# Stripe Embedded Checkout Integration

A complete Stripe embedded checkout implementation that displays plan details, pricing, and device limits before payment.

## Features

✅ **Embedded Stripe Checkout** - Checkout form embedded directly in your app
✅ **Plan Details Display** - Shows plan name, price, device limit, and duration before payment
✅ **Feature List** - Displays included features to users
✅ **Dual Payment Options** - Supports both Stripe (card) and Telebirr payments
✅ **Automatic Subscription Activation** - Activates subscription immediately after successful payment
✅ **Secure Webhook Handling** - Stripe webhooks for payment confirmation
✅ **Mobile Responsive** - Works seamlessly on all device sizes

## Architecture

### Frontend Components

**StripeCheckoutModal Component** (`frontend/src/components/StripeCheckoutModal.tsx`)
- Modal dialog with plan details
- Embedded Stripe checkout form
- Loading states and error handling
- Shows plan information before payment:
  - Plan name
  - Device limit
  - Duration
  - Total price
  - Feature list

### Backend Integration

**Payment Route** (`backend/src/routes/payment.ts`)
- `/api/payment/pay` - Creates checkout session with `clientSecret`
- `/api/payment/webhook/stripe` - Handles Stripe webhooks
- Supports both embedded and hosted checkout modes

**Stripe Service** (`backend/src/services/stripePayment.ts`)
- `createEmbeddedCheckoutSession()` - Creates session with `ui_mode: 'embedded'`
- `verifyWebhook()` - Validates webhook signatures
- `retrieveSession()` - Fetches session details

## Setup Instructions

### 1. Install Dependencies

Frontend packages are already installed:
```bash
@stripe/stripe-js
@stripe/react-stripe-js
```

Backend packages are already installed:
```bash
stripe
```

### 2. Configure Environment Variables

**Backend** (`.env`):
```bash
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
FRONTEND_URL=http://localhost:5173
```

**Frontend** (`.env`):
```bash
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
VITE_API_URL=http://localhost:3000/api
```

### 3. Get Stripe Keys

1. Sign up at [stripe.com](https://stripe.com)
2. Go to [API Keys](https://dashboard.stripe.com/apikeys)
3. Copy your **Publishable key** (starts with `pk_test_`) to frontend `.env`
4. Copy your **Secret key** (starts with `sk_test_`) to backend `.env`

### 4. Set Up Webhook

1. Go to [Stripe Webhooks](https://dashboard.stripe.com/webhooks)
2. Click "Add endpoint"
3. URL: `https://yourdomain.com/api/payment/webhook/stripe`
4. Select events:
   - `checkout.session.completed`
   - `checkout.session.expired`
5. Copy the signing secret (starts with `whsec_`) to backend `.env`

## User Flow

### Payment Process

1. **User browses plans** on Dashboard
2. **Clicks "Pay with Card (Stripe)"** button
3. **Modal opens** showing:
   - Plan name (e.g., "Pro Plan")
   - Device limit (e.g., "10 devices")
   - Duration (e.g., "30 days")
   - Total amount (e.g., "$29.99")
   - Feature list
4. **User clicks "Proceed to Payment"**
5. **Embedded checkout form loads** within the modal
6. **User enters card details** (stays on your site)
7. **Payment processes** through Stripe
8. **Webhook fires** to confirm payment
9. **Subscription activates** automatically
10. **User redirected** to success page

### Alternative: Telebirr Payment

Users can also click "Pay with Telebirr" to use the Telebirr payment gateway instead.

## API Endpoints

### Create Payment Session

```http
POST /api/payment/pay
Authorization: Bearer <token>
Content-Type: application/json

{
  "planId": "plan_id_here",
  "paymentGateway": "stripe",
  "useEmbedded": true
}
```

**Response:**
```json
{
  "success": true,
  "gateway": "stripe",
  "embedded": true,
  "orderId": "ORDER_1234567890_abc123",
  "invoiceNumber": "INV-20241008-001",
  "clientSecret": "cs_test_...",
  "sessionId": "cs_test_..."
}
```

### Webhook Handler

```http
POST /api/payment/webhook/stripe
Content-Type: application/json
Stripe-Signature: t=...,v1=...

{
  "type": "checkout.session.completed",
  "data": {
    "object": {
      "id": "cs_test_...",
      "payment_status": "paid",
      "metadata": {
        "orderId": "ORDER_...",
        "userId": "user_...",
        "planId": "plan_..."
      }
    }
  }
}
```

## Code Example

### Using the Modal Component

```typescript
import { StripeCheckoutModal } from '../components/StripeCheckoutModal';

function Dashboard() {
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const handlePayment = (plan) => {
    setSelectedPlan(plan);
    setShowModal(true);
  };

  return (
    <>
      <button onClick={() => handlePayment(plan)}>
        Pay with Card
      </button>

      {selectedPlan && (
        <StripeCheckoutModal
          plan={selectedPlan}
          isOpen={showModal}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
```

## Testing

### Test Cards

Use these test cards in **test mode**:

| Card Number | Scenario |
|------------|----------|
| 4242 4242 4242 4242 | Success |
| 4000 0000 0000 0002 | Decline |
| 4000 0025 0000 3155 | 3D Secure |

For all cards:
- Use any future expiry date
- Use any 3-digit CVC
- Use any postal code

### Test Webhook Locally

Use Stripe CLI:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/payment/webhook/stripe

# Trigger test webhook
stripe trigger checkout.session.completed
```

## Security Features

✅ **Webhook Signature Verification** - All webhooks are verified using `STRIPE_WEBHOOK_SECRET`
✅ **Client Secret** - One-time use token for each checkout session
✅ **HTTPS Required** - Stripe requires HTTPS in production
✅ **PCI Compliance** - Card data never touches your servers
✅ **Order ID Tracking** - Prevents duplicate payment processing

## Troubleshooting

### Modal doesn't open
- Check `VITE_STRIPE_PUBLISHABLE_KEY` is set in frontend `.env`
- Verify plan object has all required fields

### Checkout form doesn't load
- Confirm `clientSecret` is returned from API
- Check browser console for Stripe errors
- Verify Stripe.js is loaded successfully

### Payment not completing
- Check webhook endpoint is accessible
- Verify `STRIPE_WEBHOOK_SECRET` is correct
- Review Stripe Dashboard webhook logs

### Subscription not activated
- Check webhook is receiving `checkout.session.completed` event
- Verify `planId` is in session metadata
- Review backend logs for errors

## Going to Production

1. **Switch to live keys** in both frontend and backend `.env`
2. **Update webhook endpoint** to production URL
3. **Enable HTTPS** on your domain
4. **Test with real card** (small amount)
5. **Monitor Stripe Dashboard** for successful payments

## Support

- **Stripe Documentation**: [stripe.com/docs](https://stripe.com/docs)
- **Stripe Testing**: [stripe.com/docs/testing](https://stripe.com/docs/testing)
- **Webhook Guide**: [stripe.com/docs/webhooks](https://stripe.com/docs/webhooks)

## What's Included

✅ Modal UI with plan details
✅ Embedded Stripe Elements
✅ Error handling and loading states
✅ Webhook processing
✅ Subscription activation
✅ Payment history tracking
✅ Invoice generation
✅ Mobile responsive design
✅ Secure and PCI compliant
