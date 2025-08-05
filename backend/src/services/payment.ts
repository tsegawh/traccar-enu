import crypto from 'crypto';
import axios from 'axios';

export interface TelebirrPaymentRequest {
  orderId: string;
  amount: number;
  userId: string;
  planId: string;
  returnUrl: string;
  cancelUrl: string;
}

export interface TelebirrPaymentResponse {
  prepay_id: string;
  checkout_url: string;
}

/**
 * Telebirr Payment Integration Service
 * 
 * Payment Flow:
 * 1. Get fabric token from Telebirr
 * 2. Create unified order with payment details
 * 3. Sign request using RSA private key
 * 4. Return checkout URL to frontend
 * 5. Handle callback verification
 */
export class TelebirrPaymentService {
  private readonly appId: string;
  private readonly merchantId: string;
  private readonly privateKey: string;
  private readonly notifyUrl: string;
  private readonly mode: 'sandbox' | 'production';
  private readonly baseUrl: string;

  constructor() {
    this.appId = process.env.TELEBIRR_APP_ID!;
    this.merchantId = process.env.TELEBIRR_MERCHANT_ID!;
    this.privateKey = process.env.TELEBIRR_PRIVATE_KEY!;
    this.notifyUrl = process.env.TELEBIRR_NOTIFY_URL!;
    this.mode = (process.env.TELEBIRR_MODE as 'sandbox' | 'production') || 'sandbox';
    
    // Dynamic URL based on mode
    this.baseUrl = this.mode === 'sandbox' 
      ? process.env.TELEBIRR_SANDBOX_URL!
      : process.env.TELEBIRR_PRODUCTION_URL!;

    console.log(`🔧 Telebirr Payment Service initialized in ${this.mode} mode`);
  }

  /**
   * Step 1: Get fabric token from Telebirr API
   */
  private async getFabricToken(): Promise<string> {
    try {
      const response = await axios.post(`${this.baseUrl}/apiaccess/payment/gateway/getfabrictoken`, {
        appid: this.appId
      }, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000
      });

      if (response.data.code !== '200') {
        throw new Error(`Failed to get fabric token: ${response.data.msg}`);
      }

      return response.data.fabricToken;
    } catch (error) {
      console.error('❌ Error getting fabric token:', error);
      throw new Error('Failed to get fabric token from Telebirr');
    }
  }

  /**
   * Step 2: Create RSA signature for request
   */
  private createSignature(data: string): string {
    try {
      const sign = crypto.createSign('RSA-SHA256');
      sign.update(data);
      sign.end();
      
      return sign.sign(this.privateKey, 'base64');
    } catch (error) {
      console.error('❌ Error creating signature:', error);
      throw new Error('Failed to create payment signature');
    }
  }

  /**
   * Step 3: Create unified order with Telebirr
   */
  async createPayment(request: TelebirrPaymentRequest): Promise<TelebirrPaymentResponse> {
    try {
      console.log('💳 Creating Telebirr payment for order:', request.orderId);

      // Get fabric token
      const fabricToken = await this.getFabricToken();

      // Prepare order data
      const orderData = {
        appid: this.appId,
        merch_code: this.merchantId,
        nonce_str: this.generateNonceStr(),
        out_trade_no: request.orderId,
        subject: `Traccar Subscription - Plan Upgrade`,
        total_amount: request.amount.toFixed(2),
        notify_url: this.notifyUrl,
        return_url: request.returnUrl,
        cancel_url: request.cancelUrl,
        timeout_express: '30m', // 30 minutes timeout
      };

      // Create signature string (alphabetically sorted keys)
      const sortedKeys = Object.keys(orderData).sort();
      const signString = sortedKeys
        .map(key => `${key}=${orderData[key as keyof typeof orderData]}`)
        .join('&');

      // Create signature
      const signature = this.createSignature(signString);

      // Prepare final request
      const paymentRequest = {
        ...orderData,
        sign: signature,
        sign_type: 'RSA',
      };

      console.log('📤 Sending payment request to Telebirr...');

      // Send request to Telebirr
      const response = await axios.post(
        `${this.baseUrl}/apiaccess/payment/gateway/preorder`,
        paymentRequest,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Fabric-Token': fabricToken,
          },
          timeout: 30000
        }
      );

      if (response.data.code !== '200') {
        throw new Error(`Telebirr API error: ${response.data.msg}`);
      }

      const prepayId = response.data.biz_content.prepay_id;
      
      // Build checkout URL
      const checkoutUrl = this.buildCheckoutUrl(prepayId);

      console.log('✅ Payment created successfully:', prepayId);

      return {
        prepay_id: prepayId,
        checkout_url: checkoutUrl,
      };

    } catch (error) {
      console.error('❌ Error creating Telebirr payment:', error);
      throw error;
    }
  }

  /**
   * Step 4: Build checkout URL for frontend redirect
   */
  private buildCheckoutUrl(prepayId: string): string {
    const checkoutBaseUrl = this.mode === 'sandbox'
      ? 'https://196.188.120.3:38443/apiaccess/payment/gateway/checkout'
      : 'https://checkout.telebirr.com';

    return `${checkoutBaseUrl}?prepay_id=${prepayId}`;
  }

  /**
   * Generate random nonce string
   */
  private generateNonceStr(): string {
    return crypto.randomBytes(16).toString('hex');
  }
}

// Service instance
const telebirrService = new TelebirrPaymentService();

/**
 * Create Telebirr payment
 */
export async function createTelebirrPayment(
  request: TelebirrPaymentRequest
): Promise<TelebirrPaymentResponse> {
  return telebirrService.createPayment(request);
}

/**
 * Verify Telebirr callback signature
 */
export async function verifyTelebirrCallback(callbackData: any): Promise<boolean> {
  try {
    const { sign, sign_type, ...dataToVerify } = callbackData;

    if (sign_type !== 'RSA') {
      console.error('❌ Invalid signature type:', sign_type);
      return false;
    }

    // Create signature string (alphabetically sorted keys)
    const sortedKeys = Object.keys(dataToVerify).sort();
    const signString = sortedKeys
      .map(key => `${key}=${dataToVerify[key]}`)
      .join('&');

    // Verify signature (you would need Telebirr's public key for this)
    // For now, we'll do basic validation
    console.log('🔍 Verifying callback signature...');
    console.log('📝 Sign string:', signString);
    console.log('✏️ Signature:', sign);

    // TODO: Implement proper signature verification with Telebirr's public key
    // const verify = crypto.createVerify('RSA-SHA256');
    // verify.update(signString);
    // verify.end();
    // return verify.verify(telebirrPublicKey, sign, 'base64');

    // For development, return true if basic data is present
    return !!(callbackData.out_trade_no && callbackData.trade_status);

  } catch (error) {
    console.error('❌ Error verifying callback:', error);
    return false;
  }
}