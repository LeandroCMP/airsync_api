import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Subscription,
  SubscriptionDocument,
  SubscriptionPaymentMethod,
  SubscriptionStatus
} from './subscription.schema';
import {
  SubscriptionInvoice,
  SubscriptionInvoiceDocument,
  SubscriptionInvoiceStatus
} from './subscription-invoice.schema';
import {
  SubscriptionPaymentLog,
  SubscriptionPaymentLogDocument
} from './subscription-payment-log.schema';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { PayInvoiceDto } from './dto/pay-invoice.dto';
import { NegotiateInvoiceDto } from './dto/negotiate-invoice.dto';
import { Tenant, TenantDocument } from '../../core/tenancy/tenant.schema';
import { NotificationService } from '../../core/notifications/notification.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { StripeService } from './stripe.service';
import Stripe from 'stripe';
import { CreateCarnetDto } from './dto/create-carnet.dto';
import { FinanceService } from '../finance/finance.service';
import { ConfigService } from '@nestjs/config';

const DEFAULT_PLAN = {
  code: 'standard',
  name: 'AirSync Standard',
  amount: 120,
  currency: 'BRL',
  interval: 'monthly' as const,
  seats: 10
};

const FREE_TRIAL_DAYS = 10;

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @InjectModel(Subscription.name) private readonly subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(SubscriptionInvoice.name) private readonly invoiceModel: Model<SubscriptionInvoiceDocument>,
    @InjectModel(SubscriptionPaymentLog.name)
    private readonly paymentLogModel: Model<SubscriptionPaymentLogDocument>,
    @InjectModel(Tenant.name) private readonly tenantModel: Model<TenantDocument>,
    private readonly notificationService: NotificationService,
    private readonly stripeService: StripeService,
    private readonly financeService: FinanceService,
    private readonly configService: ConfigService
  ) {}

  private addDays(date: Date, days: number) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private addMonths(date: Date, months: number) {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
  }

  private normalizePlanAmount(amount: number) {
    if (!amount || Number.isNaN(amount)) return 0;
    const amountInCents = this.configService.get<boolean>('subscriptions.amountInCents');
    const normalized = amountInCents ? amount / 100 : amount;
    return Number(normalized.toFixed(2));
  }

  private intervalToMonths(interval: 'monthly' | 'annual') {
    return interval === 'annual' ? 12 : 1;
  }

  private generateInvoiceNumber(tenantId: string) {
    return `INV-${tenantId}-${Date.now()}`;
  }

  private async logPaymentEvent(payload: Partial<SubscriptionPaymentLog>) {
    try {
      await this.paymentLogModel.create(payload);
    } catch (err) {
      this.logger.warn(
        `Failed to log payment event for tenant=${payload.tenantId}`,
        err instanceof Error ? err.stack : undefined
      );
    }
  }

  private computeNextBillingDate(day: number, reference?: Date) {
    const base = reference ? new Date(reference) : new Date();
    const target = new Date(base.getFullYear(), base.getMonth(), day);
    if (target <= base) {
      target.setMonth(target.getMonth() + 1);
    }
    return target;
  }

  private calculateProratedAmount(planAmount: number, days: number) {
    if (days <= 0) {
      return 0;
    }
    const dailyRate = Math.ceil(planAmount / 30);
    const total = dailyRate * days;
    return Math.min(planAmount, Math.max(dailyRate, total));
  }

  async ensureSubscription(tenantId: string, preferredBillingDay?: number) {
    let subscription = await this.subscriptionModel.findOne({ tenantId });
    if (subscription) {
      const normalizedAmount = this.normalizePlanAmount(subscription.plan?.amount || 0);
      if (normalizedAmount !== subscription.plan.amount) {
        subscription.plan.amount = normalizedAmount;
        await subscription.save();
      }
      return subscription;
    }
    const now = new Date();
    const trialEnds = this.addDays(now, FREE_TRIAL_DAYS);
    const billingDay = preferredBillingDay || now.getDate();
    const nextBillingAt = this.computeNextBillingDate(billingDay, now);
    subscription = await this.subscriptionModel.create({
      tenantId,
      plan: DEFAULT_PLAN,
      planCode: 'AIRSYNC_STANDARD',
      status: 'trial',
      trialEndsAt: trialEnds,
      billingDay,
      nextBillingAt,
      startedAt: now,
      renewsAt: nextBillingAt,
      graceDays: 5,
      reminderDays: 5,
      preferredPaymentMethod: 'PIX'
    });
    return subscription;
  }

  private async createUpcomingInvoice(subscription: SubscriptionDocument) {
    const planAmount = this.normalizePlanAmount(subscription.plan.amount);
    const months = this.intervalToMonths(subscription.plan.interval);
    const lastInvoice = await this.invoiceModel
      .findOne({ tenantId: subscription.tenantId })
      .sort({ periodEnd: -1 });
    const periodStart = lastInvoice?.periodEnd ? new Date(lastInvoice.periodEnd) : new Date();
    const periodEnd = this.addMonths(periodStart, months);
    const dueDate =
      subscription.nextBillingAt && subscription.nextBillingAt > periodStart
        ? subscription.nextBillingAt
        : periodEnd;
    const invoice = await this.invoiceModel.create({
      tenantId: subscription.tenantId,
      subscriptionId: subscription._id.toString(),
      number: this.generateInvoiceNumber(subscription.tenantId),
      interval: subscription.plan.interval,
      periodStart,
      periodEnd,
      dueDate,
      amount: planAmount,
      currency: subscription.plan.currency,
      status: 'pending'
    });
    await this.ensureFinanceReceivable(invoice);
    this.logger.log(
      `Fatura criada | tenant=${subscription.tenantId} fatura=${invoice._id.toString()} amount=${invoice.amount} due=${dueDate.toISOString()}`
    );
    subscription.nextBillingAt = this.addMonths(dueDate, months);
    if (subscription.status === 'trial' && (!subscription.trialEndsAt || dueDate > subscription.trialEndsAt)) {
      subscription.status = 'active';
    }
    await subscription.save();
    return invoice;
  }

  private async ensureCarnetInvoices(subscription: SubscriptionDocument) {
    const tenantId = subscription.tenantId;
    // If already generated once, skip
    if (subscription.carnetGeneratedAt) {
      return [];
    }
    const existingInvoices = await this.invoiceModel.find({ tenantId }).lean();
    if (existingInvoices.length) {
      return [];
    }
    const pending = await this.invoiceModel
      .find({ tenantId, status: { $in: ['pending', 'past_due'] } })
      .sort({ dueDate: 1 });
    let count = pending.length;
    if (count >= 6) {
      subscription.carnetGeneratedAt = subscription.carnetGeneratedAt || new Date();
      await subscription.save();
      return [];
    }
    const now = new Date();
    let base =
      subscription.trialEndsAt && subscription.trialEndsAt > now
        ? new Date(subscription.trialEndsAt)
        : now;
    const created: SubscriptionInvoiceDocument[] = [];
    while (count < 6) {
      const periodStart = base;
      const periodEnd = this.addMonths(base, 1);
      const dueDate = subscription.billingDay
        ? this.computeNextBillingDate(subscription.billingDay, base)
        : periodEnd;
      const invoice = await this.invoiceModel.create({
        tenantId,
        subscriptionId: subscription._id.toString(),
        number: this.generateInvoiceNumber(tenantId),
        interval: 'monthly',
        periodStart,
        periodEnd,
        dueDate,
        amount: subscription.plan.amount,
        currency: subscription.plan.currency,
        status: 'pending',
        notes: 'Carnê 6 meses'
      });
      await this.ensureFinanceReceivable(invoice);
      created.push(invoice);
      this.logger.log(
        `Fatura de carnê criada | tenant=${tenantId} fatura=${invoice._id.toString()} amount=${invoice.amount} due=${dueDate.toISOString()}`
      );
      base = periodEnd;
      count++;
    }
    subscription.carnetGeneratedAt = new Date();
    await subscription.save();
    return created;
  }

  private async ensureFinanceReceivable(invoice: SubscriptionInvoiceDocument) {
    const ref = `subscription:invoice:${invoice._id.toString()}`;
    if (invoice.amount <= 0) return null;
    const existing = await this.financeService.findByRef(invoice.tenantId, ref);
    if (existing) return existing;
    const tx = await this.financeService.create(
      invoice.tenantId,
      {
        type: 'receivable',
        ref,
        category: 'subscriptions',
        description: `Mensalidade ${invoice.number}`,
        dueDate: invoice.dueDate,
        amount: invoice.amount
      },
      'system'
    );
    this.logger.log(
      `Título financeiro criado | tenant=${invoice.tenantId} ref=${ref} fatura=${invoice._id.toString()} amount=${invoice.amount}`
    );
    return tx;
  }

  private async markFinancePaid(invoice: SubscriptionInvoiceDocument, method?: string, by?: string) {
    const ref = `subscription:invoice:${invoice._id.toString()}`;
    let tx = await this.financeService.findByRef(invoice.tenantId, ref);
    if (!tx) {
      tx = await this.ensureFinanceReceivable(invoice);
    }
    const txId = (tx as any)?._id?.toString?.() ?? (tx as any)?._id;
    if (!txId) return;
    await this.financeService.pay(
      invoice.tenantId,
      txId,
      {
        method: (method as any) || 'PIX',
        amount: invoice.amount
      },
      by || 'system'
    );
    this.logger.log(
      `Título financeiro baixado | tenant=${invoice.tenantId} ref=${ref} fatura=${invoice._id.toString()} metodo=${method || 'unknown'}`
    );
  }

  async createCarnet(tenantId: string, dto: CreateCarnetDto) {
    const subscription = await this.ensureSubscription(tenantId);
    const amount = this.normalizePlanAmount(subscription.plan.amount);
    const baseDate = new Date();
    const created: SubscriptionInvoiceDocument[] = [];

    if (dto.payUpfront) {
      const total = Number((amount * 6 * 0.8).toFixed(2));
      const invoice = await this.invoiceModel.create({
        tenantId,
        subscriptionId: subscription._id.toString(),
        number: this.generateInvoiceNumber(tenantId),
        interval: 'monthly',
        periodStart: baseDate,
        periodEnd: this.addMonths(baseDate, 6),
        dueDate: baseDate,
        amount: total,
        currency: subscription.plan.currency,
        status: 'pending',
        notes: 'Carnê 6 meses - pagamento à vista com 20% de desconto'
      });
      await this.ensureFinanceReceivable(invoice);
      created.push(invoice);
    } else {
      for (let i = 0; i < 6; i++) {
        const dueDate = this.addMonths(baseDate, i);
        const invoice = await this.invoiceModel.create({
          tenantId,
          subscriptionId: subscription._id.toString(),
          number: this.generateInvoiceNumber(tenantId),
          interval: 'monthly',
          periodStart: this.addMonths(baseDate, i),
          periodEnd: this.addMonths(baseDate, i + 1),
          dueDate,
          amount,
          currency: subscription.plan.currency,
          status: 'pending',
          notes: 'Carnê 6 meses'
        });
        await this.ensureFinanceReceivable(invoice);
        created.push(invoice);
      }
    }

    return { invoices: created.map((inv) => inv.toObject()) };
  }

  async getCurrent(tenantId: string) {
    const subscription = await this.ensureSubscription(tenantId);
    const invoices = await this.invoiceModel
      .find({ tenantId })
      .sort({ dueDate: -1 })
      .limit(12)
      .lean();
    return {
      subscription: subscription.toObject(),
      invoices,
      billingStatus: subscription.status,
      accountSuspended: subscription.status === 'suspended'
    };
  }

  async updateCurrent(tenantId: string, dto: UpdateSubscriptionDto) {
    const subscription = await this.ensureSubscription(tenantId);
    if (dto.billingDay !== undefined) {
      subscription.billingDay = dto.billingDay;
      subscription.nextBillingAt = this.computeNextBillingDate(dto.billingDay);
      subscription.renewsAt = subscription.nextBillingAt;
    }
    subscription.billingContact = {
      name: dto.billingContactName ?? subscription.billingContact?.name,
      email: dto.billingContactEmail ?? subscription.billingContact?.email,
      phone: dto.billingContactPhone ?? subscription.billingContact?.phone
    };
    if (dto.preferredPaymentMethod) {
      subscription.preferredPaymentMethod = dto.preferredPaymentMethod;
    }
    await subscription.save();
    return subscription.toObject();
  }

  async listInvoices(
    tenantId: string,
    filters: { status?: SubscriptionInvoiceStatus; from?: string; to?: string }
  ) {
    const query: any = { tenantId };
    if (filters.status) {
      query.status = filters.status;
    }
    if (filters.from || filters.to) {
      query.dueDate = {};
      if (filters.from) query.dueDate.$gte = new Date(filters.from);
      if (filters.to) query.dueDate.$lte = new Date(filters.to);
    }
    return this.invoiceModel.find(query).sort({ dueDate: -1 }).lean();
  }

  async getInvoice(tenantId: string, invoiceId: string) {
    const invoice = await this.invoiceModel.findOne({ tenantId, _id: invoiceId });
    if (!invoice) {
      throw new NotFoundException({ code: 'INVOICE_NOT_FOUND', message: 'Fatura nao encontrada.' });
    }
    return invoice;
  }

  async recordPayment(tenantId: string, invoiceId: string, dto: PayInvoiceDto, by: string) {
    const invoice = await this.getInvoice(tenantId, invoiceId);
    if (invoice.status === 'paid') {
      throw new BadRequestException({ code: 'INVOICE_ALREADY_PAID', message: 'Esta fatura ja foi paga.' });
    }
    if (dto.amount <= 0) {
      throw new BadRequestException({ code: 'INVALID_AMOUNT', message: 'Informe um valor maior que zero.' });
    }
    invoice.payments.push({
      method: dto.method as SubscriptionPaymentMethod,
      amount: dto.amount,
      paidAt: new Date(),
      notes: dto.notes
    } as any);
    invoice.status = 'paid';
    invoice.paidAt = new Date();
    invoice.paymentMethod = dto.method as SubscriptionPaymentMethod;
    await invoice.save();
    await this.markFinancePaid(invoice, dto.method, by);
    this.logger.log(
      `Pagamento manual registrado | tenant=${tenantId} fatura=${invoice._id.toString()} amount=${dto.amount} metodo=${dto.method}`
    );
    await this.logPaymentEvent({
      tenantId,
      invoiceId: invoice._id.toString(),
      type: 'manual_payment',
      status: 'paid',
      payload: { method: dto.method, amount: dto.amount, by }
    });
    this.logger.log(`Manual payment recorded | tenant=${tenantId} fatura=${invoice._id.toString()}`);
    await this.evaluateAndApplyStatus(tenantId);
    return invoice.toObject();
  }

  async negotiateInvoice(tenantId: string, invoiceId: string, dto: NegotiateInvoiceDto, by: string) {
    const invoice = await this.getInvoice(tenantId, invoiceId);
    if (invoice.status === 'paid') {
      throw new BadRequestException({ code: 'INVOICE_ALREADY_PAID', message: 'Nao e possivel renegociar uma fatura paga.' });
    }
    const subscription = await this.ensureSubscription(tenantId);
    if (dto.amount <= 0) {
      throw new BadRequestException({ code: 'INVALID_AMOUNT', message: 'Informe um valor maior que zero.' });
    }
    dto.amount = this.normalizePlanAmount(dto.amount);
    invoice.status = 'void';
    invoice.notes = `Renegociado por ${by} em ${new Date().toISOString()}`;
    await invoice.save();
    await this.financeService.voidByRef(tenantId, `subscription:invoice:${invoice._id.toString()}`);
    const nextDue = new Date(dto.dueDate);
    if (Number.isNaN(nextDue.getTime())) {
      throw new BadRequestException({ code: 'INVALID_DUE_DATE', message: 'Data de vencimento invalida.' });
    }
    const newInvoice = await this.invoiceModel.create({
      tenantId,
      subscriptionId: subscription._id.toString(),
      number: this.generateInvoiceNumber(tenantId),
      interval: subscription.plan.interval,
      periodStart: invoice.periodStart,
      periodEnd: invoice.periodEnd,
      dueDate: nextDue,
      amount: dto.amount,
      currency: subscription.plan.currency,
      status: 'pending',
      parentInvoiceId: invoice._id.toString(),
      notes: dto.notes
    });
    await this.ensureFinanceReceivable(newInvoice);
    this.logger.log(
      `Fatura renegociada | tenant=${tenantId} oldInvoice=${invoiceId} newInvoice=${newInvoice._id.toString()} amount=${dto.amount} due=${nextDue.toISOString()}`
    );
    await this.evaluateAndApplyStatus(tenantId);
    return newInvoice.toObject();
  }

  async createPaymentIntent(
    tenantId: string,
    invoiceId: string,
    dto: CreatePaymentIntentDto
  ) {
    if (!this.stripeService.isEnabled()) {
      throw new BadRequestException({
        code: 'STRIPE_DISABLED',
        message: 'Pagamento online nao configurado no momento.'
      });
    }
    const invoice = await this.getInvoice(tenantId, invoiceId);
    if (invoice.status === 'paid') {
      throw new BadRequestException({ code: 'INVOICE_ALREADY_PAID', message: 'Esta fatura ja foi paga.' });
    }
    const subscription = await this.ensureSubscription(tenantId);
    const method: SubscriptionPaymentMethod =
      dto.method || subscription.preferredPaymentMethod || 'PIX';
    const intent = await this.stripeService.createPaymentIntent({
      amount: invoice.amount,
      currency: invoice.currency,
      metadata: {
        tenantId,
        invoiceId: invoice._id.toString()
      },
      customerEmail: subscription.billingContact?.email,
      method,
      successUrl: dto.successUrl,
      cancelUrl: dto.cancelUrl
    });
    invoice.gatewayPaymentIntentId = intent.id;
    invoice.gatewayPaymentStatus = intent.status;
    invoice.gatewayClientSecret = intent.client_secret || undefined;
    invoice.paymentMethod = method;
    await invoice.save();
    await this.logPaymentEvent({
      tenantId,
      invoiceId: invoice._id.toString(),
      type: 'intent_created',
      status: intent.status,
      payload: { paymentIntentId: intent.id, method }
    });
    this.logger.log(
      `Stripe PaymentIntent created | tenant=${tenantId} fatura=${invoice._id.toString()} intent=${intent.id}`
    );
    return {
      paymentIntentId: intent.id,
      clientSecret: intent.client_secret,
      status: intent.status,
      nextAction: intent.next_action,
      paymentMethod: method
    };
  }

  private mapStripeMethod(method?: string): SubscriptionPaymentMethod | undefined {
    if (!method) return undefined;
    if (method === 'pix') {
      return 'PIX';
    }
    if (method === 'card') {
      return 'CARD_CREDIT';
    }
    return undefined;
  }

  private async markInvoiceAsPaidByGateway(intent: Stripe.PaymentIntent) {
    const invoice = await this.invoiceModel.findOne({ gatewayPaymentIntentId: intent.id });
    if (!invoice) {
      await this.logPaymentEvent({
        tenantId: intent.metadata?.tenantId || 'unknown',
        invoiceId: intent.metadata?.invoiceId,
        type: 'webhook_succeeded_invoice_missing',
        status: intent.status,
        payload: { paymentIntentId: intent.id }
      });
      this.logger.warn(
        `Stripe payment succeeded but invoice not found | intent=${intent.id} tenant=${intent.metadata?.tenantId}`
      );
      return;
    }
    invoice.status = 'paid';
    invoice.paidAt = new Date();
    invoice.gatewayPaymentStatus = intent.status;
    const method = this.mapStripeMethod(intent.payment_method_types?.[0]);
    const resolvedMethod = method || invoice.paymentMethod || 'PIX';
    invoice.paymentMethod = resolvedMethod;
    if (!invoice.payments.find((p) => p.notes === intent.id)) {
      invoice.payments.push({
        method: resolvedMethod,
        amount: invoice.amount,
        paidAt: new Date(),
        notes: intent.id
      } as any);
    }
    await invoice.save();
    await this.markFinancePaid(invoice, resolvedMethod, 'system');
    await this.logPaymentEvent({
      tenantId: invoice.tenantId,
      invoiceId: invoice._id.toString(),
      type: 'webhook_succeeded',
      status: intent.status,
      payload: { paymentIntentId: intent.id }
    });
    this.logger.log(
      `Stripe payment succeeded | tenant=${invoice.tenantId} fatura=${invoice._id.toString()} intent=${intent.id}`
    );
    await this.notificationService.notify({
      type: 'subscription_payment_confirmed',
      tenantId: invoice.tenantId,
      invoiceId: invoice._id.toString(),
      message: `Pagamento confirmado automaticamente via Stripe (${invoice.number})`
    });
    await this.evaluateAndApplyStatus(invoice.tenantId);
  }

  private async markInvoiceAsFailed(intent: Stripe.PaymentIntent) {
    const invoice = await this.invoiceModel.findOne({ gatewayPaymentIntentId: intent.id });
    if (!invoice) {
      await this.logPaymentEvent({
        tenantId: intent.metadata?.tenantId || 'unknown',
        invoiceId: intent.metadata?.invoiceId,
        type: 'webhook_failed_invoice_missing',
        status: intent.status,
        payload: { paymentIntentId: intent.id }
      });
      this.logger.warn(
        `Stripe payment failed but invoice not found | intent=${intent.id} tenant=${intent.metadata?.tenantId}`
      );
      return;
    }
    invoice.gatewayPaymentStatus = intent.status;
    await invoice.save();
    await this.notificationService.notify({
      type: 'subscription_payment_failed',
      tenantId: invoice.tenantId,
      invoiceId: invoice._id.toString(),
      message: `Falha ao cobrar a fatura ${invoice.number}. Verifique os dados de pagamento.`
    });
    await this.logPaymentEvent({
      tenantId: invoice.tenantId,
      invoiceId: invoice._id.toString(),
      type: 'webhook_failed',
      status: intent.status,
      payload: { paymentIntentId: intent.id }
    });
    this.logger.warn(
      `Stripe payment failed | tenant=${invoice.tenantId} fatura=${invoice._id.toString()} intent=${intent.id}`
    );
  }

  async handleStripeWebhook(payload: Buffer, signature: string) {
    if (!this.stripeService.isEnabled()) {
      return { received: true };
    }
    let event: Stripe.Event;
    try {
      event = this.stripeService.constructEvent(payload, signature);
    } catch (err) {
      this.logger.error('Stripe webhook signature invalid', err instanceof Error ? err.stack : undefined);
      throw err;
    }
    const intent = event.data.object as Stripe.PaymentIntent;
    this.logger.log(
      `Stripe webhook received | type=${event.type} intent=${intent?.id ?? 'n/a'} tenant=${
        intent?.metadata?.tenantId ?? 'n/a'
      }`
    );
    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.markInvoiceAsPaidByGateway(event.data.object as Stripe.PaymentIntent);
        break;
      case 'payment_intent.payment_failed':
        await this.markInvoiceAsFailed(event.data.object as Stripe.PaymentIntent);
        break;
      default:
        break;
    }
    return { received: true };
  }

  async getAlerts(tenantId: string) {
    const subscription = await this.ensureSubscription(tenantId);
    const pendingInvoice = await this.invoiceModel
      .findOne({
        tenantId,
        status: { $in: ['pending', 'past_due'] }
      })
      .sort({ dueDate: 1 })
      .lean();
    const now = new Date();
    let daysUntilDue: number | null = null;
    let graceEndsAt: Date | null = null;
    if (pendingInvoice) {
      daysUntilDue = Math.ceil((pendingInvoice.dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      graceEndsAt = this.addDays(pendingInvoice.dueDate, subscription.graceDays || 5);
    }
    return {
      subscription,
      pendingInvoice,
      daysUntilDue,
      graceEndsAt,
      status: subscription.status
    };
  }

  async getFinancialOverview(tenantId: string) {
    const subscription = await this.ensureSubscription(tenantId);
    const invoices = await this.invoiceModel.find({ tenantId }).lean();
    const now = new Date();
    const last30 = this.addDays(now, -30);
    const revenueLast30 = invoices
      .filter((inv) => inv.status === 'paid' && inv.paidAt && inv.paidAt >= last30)
      .reduce((sum, inv) => sum + inv.amount, 0);
    const outstanding = invoices
      .filter((inv) => inv.status === 'pending' || inv.status === 'past_due')
      .reduce((sum, inv) => sum + inv.amount, 0);
    const nextInvoice = invoices
      .filter((inv) => inv.status === 'pending')
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0];
    return {
      subscription,
      mrr: subscription.plan.interval === 'monthly' ? subscription.plan.amount : subscription.plan.amount / 12,
      arr: subscription.plan.interval === 'annual' ? subscription.plan.amount : subscription.plan.amount * 12,
      revenueLast30,
      outstanding,
      nextInvoice
    };
  }

  async evaluateAndApplyStatus(tenantId: string) {
    const subscription = await this.ensureSubscription(tenantId);
    const previousStatus = subscription.status;
    const pendingInvoice = await this.invoiceModel
      .findOne({
        tenantId,
        status: { $in: ['pending', 'past_due'] }
      })
      .sort({ dueDate: 1 });
    const now = new Date();
    let status: SubscriptionStatus = 'active';
    let suspendedReason: string | undefined;
    let graceUntil: Date | undefined;
    if (pendingInvoice) {
      const dueDate = pendingInvoice.dueDate;
      const graceDays = subscription.graceDays || 5;
      graceUntil = this.addDays(dueDate, graceDays);
      if (now > graceUntil) {
        status = 'suspended';
        suspendedReason = 'Subscription overdue beyond grace period';
        pendingInvoice.status = 'past_due';
        await pendingInvoice.save();
      } else if (now > dueDate) {
        status = 'past_due';
        pendingInvoice.status = 'past_due';
        await pendingInvoice.save();
      }
    } else if (subscription.trialEndsAt && now > subscription.trialEndsAt) {
      status = 'active';
    }
    subscription.status = status;
    subscription.graceUntil = graceUntil;
    subscription.suspendedAt = status === 'suspended' ? now : undefined;
    subscription.suspendedReason = suspendedReason;
    await subscription.save();
    const billingStatus: 'active' | 'past_due' | 'suspended' =
      status === 'suspended' ? 'suspended' : status === 'past_due' ? 'past_due' : 'active';
    const tenantUpdate: any = {
      billingStatus,
      suspendedAt: status === 'suspended' ? now : null,
      suspensionReason: suspendedReason ?? null
    };
    await this.tenantModel.updateOne({ _id: tenantId }, tenantUpdate);
    if (status !== previousStatus) {
      if (status === 'past_due') {
        await this.notificationService.notify({
          type: 'subscription_past_due',
          tenantId,
          message: 'Sua assinatura está em atraso. Regularize para evitar suspensão.'
        });
      } else if (status === 'suspended') {
        await this.notificationService.notify({
          type: 'subscription_suspended',
          tenantId,
          message: 'Conta suspensa por inadimplência após o período de carência.'
        });
      } else if (previousStatus === 'suspended' && status === 'active') {
        await this.notificationService.notify({
          type: 'subscription_reactivated',
          tenantId,
          message: 'Pagamento confirmado. Acesso liberado novamente.'
        });
      }
    }
    return { subscription, pendingInvoice };
  }

  async assertTenantCanLogin(
    tenantId: string,
    userRole?: string,
    opts?: { allowOwnerSuspended?: boolean }
  ) {
    await this.evaluateAndApplyStatus(tenantId);
    const tenant = await this.tenantModel.findById(tenantId).lean();
    if (!tenant) {
      throw new ForbiddenException({ code: 'TENANT_NOT_FOUND', message: 'Conta nao encontrada.' });
    }
    if (tenant.billingStatus === 'suspended') {
      const isOwner = userRole === 'owner' || userRole === 'admin';
      if (!isOwner) {
        throw new ForbiddenException({
          code: 'ACCOUNT_SUSPENDED',
          message: 'Acesso bloqueado. Contate o responsavel da conta para regularizar o pagamento.'
        });
      }
      if (!opts?.allowOwnerSuspended) {
        throw new ForbiddenException({
          code: 'ACCOUNT_SUSPENDED',
          message: 'Conta suspensa por atraso. Pague a fatura para voltar a usar.'
        });
      }
    }
    return tenant;
  }

  private async handleReminders(subscription: SubscriptionDocument) {
    const invoices = await this.invoiceModel.find({
      tenantId: subscription.tenantId,
      status: { $in: ['pending', 'past_due'] }
    });
    const now = new Date();
    const reminderDays = subscription.reminderDays ?? 5;
    const graceDays = subscription.graceDays ?? 5;
    const midReminderDays = 3;
    for (const invoice of invoices) {
      let dirty = false;
      if (!invoice.reminderBeforeSentAt && now >= this.addDays(invoice.dueDate, -reminderDays)) {
        this.logger.warn(
          `Subscription reminder before due | tenant=${subscription.tenantId} fatura=${invoice.number}`
        );
        invoice.reminderBeforeSentAt = now;
        await this.notificationService.notify({
          type: 'subscription_reminder_before',
          tenantId: subscription.tenantId,
          invoiceId: invoice._id.toString(),
          message: `Fatura ${invoice.number} vence em breve`
        });
        dirty = true;
      }
      if (!invoice.reminderAtDueSentAt && now >= invoice.dueDate) {
        this.logger.warn(
          `Subscription reminder at due | tenant=${subscription.tenantId} fatura=${invoice.number}`
        );
        invoice.reminderAtDueSentAt = now;
        await this.notificationService.notify({
          type: 'subscription_reminder_due',
          tenantId: subscription.tenantId,
          invoiceId: invoice._id.toString(),
          message: `Fatura ${invoice.number} vence hoje`
        });
        dirty = true;
      }
      if (!invoice.reminderMidSentAt && now >= this.addDays(invoice.dueDate, midReminderDays)) {
        this.logger.warn(
          `Subscription reminder mid late | tenant=${subscription.tenantId} fatura=${invoice.number}`
        );
        invoice.reminderMidSentAt = now;
        await this.notificationService.notify({
          type: 'subscription_reminder_mid',
          tenantId: subscription.tenantId,
          invoiceId: invoice._id.toString(),
          message: `Fatura ${invoice.number} continua em aberto. Regularize para evitar suspensão.`
        });
        dirty = true;
      }
      if (!invoice.reminderAfterSentAt && now >= this.addDays(invoice.dueDate, graceDays)) {
        this.logger.error(
          `Subscription reminder after grace | tenant=${subscription.tenantId} fatura=${invoice.number}`
        );
        invoice.reminderAfterSentAt = now;
        await this.notificationService.notify({
          type: 'subscription_reminder_after',
          tenantId: subscription.tenantId,
          invoiceId: invoice._id.toString(),
          message: `Fatura ${invoice.number} vencida. Pagamento em atraso.`
        });
        dirty = true;
      }
      if (dirty) {
        await invoice.save();
      }
    }
  }

  private async generateMissingInvoices(subscription: SubscriptionDocument) {
    const now = new Date();
    let nextBilling = subscription.nextBillingAt || subscription.trialEndsAt;
    if (!nextBilling) {
      nextBilling = this.addMonths(now, this.intervalToMonths(subscription.plan.interval));
      subscription.nextBillingAt = nextBilling;
    }
    const safetyCounterLimit = 12;
    let counter = 0;
    while (nextBilling && nextBilling <= now && counter < safetyCounterLimit) {
      await this.createUpcomingInvoice(subscription);
      nextBilling = subscription.nextBillingAt;
      counter++;
    }
  }

  async runBillingCycle(tenantId: string) {
    const subscription = await this.ensureSubscription(tenantId);
    await this.generateMissingInvoices(subscription);
    await this.handleReminders(subscription);
    return this.evaluateAndApplyStatus(tenantId);
  }
}
