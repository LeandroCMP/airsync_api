import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { SubscriptionInterval, SubscriptionPaymentMethod } from './subscription.schema';

export type SubscriptionInvoiceStatus = 'pending' | 'paid' | 'past_due' | 'void' | 'canceled';

@Schema({ _id: false })
export class SubscriptionInvoicePayment {
  @Prop({ required: true, enum: ['PIX', 'CARD_CREDIT', 'CARD_DEBIT', 'BANK_TRANSFER'] })
  method: SubscriptionPaymentMethod;

  @Prop({ required: true })
  amount: number;

  @Prop({ default: Date.now })
  paidAt: Date;

  @Prop()
  notes?: string;
}

const SubscriptionInvoicePaymentSchema = SchemaFactory.createForClass(SubscriptionInvoicePayment);

@Schema({ timestamps: true })
export class SubscriptionInvoice {
  @Prop({ required: true })
  tenantId: string;

  @Prop({ required: true })
  subscriptionId: string;

  @Prop({ required: true, unique: true })
  number: string;

  @Prop({ enum: ['monthly', 'annual'], default: 'monthly' })
  interval: SubscriptionInterval;

  @Prop()
  periodStart?: Date;

  @Prop()
  periodEnd?: Date;

  @Prop({ required: true })
  dueDate: Date;

  @Prop({ required: true })
  amount: number;

  @Prop({ default: 'BRL' })
  currency: string;

  @Prop({ enum: ['pending', 'paid', 'past_due', 'void', 'canceled'], default: 'pending' })
  status: SubscriptionInvoiceStatus;

  @Prop({ type: [SubscriptionInvoicePaymentSchema], default: [] })
  payments: SubscriptionInvoicePayment[];

  @Prop()
  paidAt?: Date;

  @Prop()
  paymentMethod?: SubscriptionPaymentMethod;

  @Prop()
  notes?: string;

  @Prop()
  parentInvoiceId?: string;

  @Prop()
  reminderBeforeSentAt?: Date;

  @Prop()
  reminderAfterSentAt?: Date;
}

export type SubscriptionInvoiceDocument = SubscriptionInvoice & Document;
export const SubscriptionInvoiceSchema = SchemaFactory.createForClass(SubscriptionInvoice);
SubscriptionInvoiceSchema.index({ tenantId: 1, status: 1, dueDate: 1 });
