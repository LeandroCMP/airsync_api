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
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { PayInvoiceDto } from './dto/pay-invoice.dto';
import { NegotiateInvoiceDto } from './dto/negotiate-invoice.dto';
import { Tenant, TenantDocument } from '../../core/tenancy/tenant.schema';

const DEFAULT_PLAN = {
  code: 'standard',
  name: 'Plano Standard',
  amount: 49900,
  currency: 'BRL',
  interval: 'monthly' as const,
  seats: 10
};

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @InjectModel(Subscription.name) private readonly subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(SubscriptionInvoice.name) private readonly invoiceModel: Model<SubscriptionInvoiceDocument>,
    @InjectModel(Tenant.name) private readonly tenantModel: Model<TenantDocument>
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

  private generateInvoiceNumber(tenantId: string) {
    return `INV-${tenantId}-${Date.now()}`;
  }

  async ensureSubscription(tenantId: string) {
    let subscription = await this.subscriptionModel.findOne({ tenantId });
    if (subscription) {
      return subscription;
    }
    const now = new Date();
    const trialEnds = this.addDays(now, 30);
    subscription = await this.subscriptionModel.create({
      tenantId,
      plan: DEFAULT_PLAN,
      status: 'trial',
      trialEndsAt: trialEnds,
      billingDay: now.getDate(),
      nextBillingAt: trialEnds,
      graceDays: 5,
      reminderDays: 5,
      preferredPaymentMethod: 'PIX'
    });
    await this.invoiceModel.create({
      tenantId,
      subscriptionId: subscription._id.toString(),
      number: this.generateInvoiceNumber(tenantId),
      interval: 'monthly',
      periodStart: now,
      periodEnd: this.addMonths(now, 1),
      dueDate: trialEnds,
      amount: DEFAULT_PLAN.amount,
      currency: DEFAULT_PLAN.currency,
      status: 'pending'
    });
    return subscription;
  }

  async getCurrent(tenantId: string) {
    const subscription = await this.ensureSubscription(tenantId);
    const invoices = await this.invoiceModel
      .find({ tenantId })
      .sort({ dueDate: -1 })
      .limit(12)
      .lean();
    return { subscription: subscription.toObject(), invoices };
  }

  async updateCurrent(tenantId: string, dto: UpdateSubscriptionDto) {
    const subscription = await this.ensureSubscription(tenantId);
    if (dto.planCode || dto.amount || dto.planName || dto.currency || dto.interval) {
      subscription.plan = {
        code: dto.planCode || subscription.plan.code,
        name: dto.planName || subscription.plan.name,
        amount: dto.amount ?? subscription.plan.amount,
        currency: dto.currency || subscription.plan.currency,
        interval: (dto.interval as any) || subscription.plan.interval,
        seats: subscription.plan.seats
      };
    }
    if (dto.billingDay !== undefined) {
      subscription.billingDay = dto.billingDay;
      subscription.nextBillingAt = this.computeNextBillingDate(dto.billingDay);
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

  private computeNextBillingDate(day: number) {
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth(), day);
    if (target <= now) {
      target.setMonth(target.getMonth() + 1);
    }
    return target;
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
      throw new NotFoundException({ code: 'INVOICE_NOT_FOUND', message: 'Invoice not found' });
    }
    return invoice;
  }

  async recordPayment(
    tenantId: string,
    invoiceId: string,
    dto: PayInvoiceDto,
    by: string
  ) {
    const invoice = await this.getInvoice(tenantId, invoiceId);
    if (invoice.status === 'paid') {
      throw new BadRequestException({ code: 'INVOICE_ALREADY_PAID', message: 'Invoice already paid' });
    }
    if (dto.amount <= 0) {
      throw new BadRequestException({ code: 'INVALID_AMOUNT', message: 'Amount must be greater than zero' });
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
    await this.evaluateAndApplyStatus(tenantId);
    return invoice.toObject();
  }

  async negotiateInvoice(tenantId: string, invoiceId: string, dto: NegotiateInvoiceDto, by: string) {
    const invoice = await this.getInvoice(tenantId, invoiceId);
    if (invoice.status === 'paid') {
      throw new BadRequestException({ code: 'INVOICE_ALREADY_PAID', message: 'Cannot negotiate a paid invoice' });
    }
    const subscription = await this.ensureSubscription(tenantId);
    if (dto.amount <= 0) {
      throw new BadRequestException({ code: 'INVALID_AMOUNT', message: 'Amount must be greater than zero' });
    }
    invoice.status = 'void';
    invoice.notes = `Renegociado por ${by} em ${new Date().toISOString()}`;
    await invoice.save();
    const nextDue = new Date(dto.dueDate);
    if (Number.isNaN(nextDue.getTime())) {
      throw new BadRequestException({ code: 'INVALID_DUE_DATE', message: 'Invalid due date' });
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
    await this.evaluateAndApplyStatus(tenantId);
    return newInvoice.toObject();
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

  async evaluateAndApplyStatus(tenantId: string) {
    const subscription = await this.ensureSubscription(tenantId);
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
    const tenantUpdate: any = {
      billingStatus: status === 'trial' ? 'active' : status,
      suspendedAt: status === 'suspended' ? now : null,
      suspensionReason: suspendedReason ?? null
    };
    await this.tenantModel.updateOne({ _id: tenantId }, tenantUpdate);
    return { subscription, pendingInvoice };
  }

  async assertTenantCanLogin(tenantId: string) {
    await this.evaluateAndApplyStatus(tenantId);
    const tenant = await this.tenantModel.findById(tenantId).lean();
    if (!tenant) {
      throw new ForbiddenException({ code: 'TENANT_NOT_FOUND', message: 'Tenant not found' });
    }
    if (tenant.billingStatus === 'suspended') {
      throw new ForbiddenException({
        code: 'ACCOUNT_SUSPENDED',
        message: 'Subscription payment overdue. Please regularize your account.'
      });
    }
  }
}
