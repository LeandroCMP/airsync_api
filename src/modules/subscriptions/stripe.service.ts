import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { SubscriptionPaymentMethod } from './subscription.schema';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private stripe?: Stripe;

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.get<string>('stripe.secretKey');
    if (secretKey) {
      this.stripe = new Stripe(secretKey);
    } else {
      this.logger.warn('Stripe secret key not configured. Gateway disabled.');
    }
  }

  isEnabled() {
    return !!this.stripe;
  }

  async createPaymentIntent(params: {
    amount: number;
    currency: string;
    metadata: Record<string, string>;
    customerEmail?: string;
    method: SubscriptionPaymentMethod;
    successUrl?: string;
    cancelUrl?: string;
  }) {
    if (!this.stripe) {
      throw new BadRequestException({
        code: 'STRIPE_DISABLED',
        message: 'Pagamento online nao configurado no momento.'
      });
    }
    const payload: Stripe.PaymentIntentCreateParams = {
      amount: Math.round(params.amount * 100),
      currency: params.currency.toLowerCase(),
      metadata: params.metadata,
      receipt_email: params.customerEmail
    };

    if (params.method === 'PIX') {
      payload.payment_method_types = ['pix'];
      payload.payment_method_data = { type: 'pix' } as Stripe.PaymentIntentCreateParams.PaymentMethodData;
      payload.confirm = true;
      payload.payment_method_options = {
        pix: {
          expires_after_seconds: 60 * 60 * 24
        }
      };
    } else {
      payload.automatic_payment_methods = { enabled: true };
    }

    return this.stripe.paymentIntents.create(payload);
  }

  async createCustomer(params: { email: string; name?: string; phone?: string; metadata?: Record<string, string> }) {
    if (!this.stripe) {
      throw new BadRequestException({
        code: 'STRIPE_DISABLED',
        message: 'Pagamento online nao configurado no momento.'
      });
    }
    return this.stripe.customers.create({
      email: params.email,
      name: params.name,
      phone: params.phone,
      metadata: params.metadata
    });
  }

  constructEvent(payload: Buffer, signature: string) {
    if (!this.stripe) {
      throw new BadRequestException({
        code: 'STRIPE_DISABLED',
        message: 'Pagamento online nao configurado no momento.'
      });
    }
    const webhookSecret = this.configService.get<string>('stripe.webhookSecret');
    if (!webhookSecret) {
      throw new BadRequestException({
        code: 'STRIPE_DISABLED',
        message: 'Webhook de pagamento nao configurado.'
      });
    }
    return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  }
}
