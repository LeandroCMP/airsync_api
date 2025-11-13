import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'suspended';
export type SubscriptionInterval = 'monthly' | 'annual';
export type SubscriptionPaymentMethod = 'PIX' | 'CARD_CREDIT' | 'CARD_DEBIT' | 'BANK_TRANSFER';

@Schema({ _id: false })
export class SubscriptionPlan {
  @Prop({ required: true })
  code: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true, default: 'BRL' })
  currency: string;

  @Prop({ required: true, enum: ['monthly', 'annual'], default: 'monthly' })
  interval: SubscriptionInterval;

  @Prop({ default: 0 })
  seats?: number;
}

const SubscriptionPlanSchema = SchemaFactory.createForClass(SubscriptionPlan);

@Schema({ _id: false })
export class SubscriptionBillingContact {
  @Prop()
  name?: string;

  @Prop()
  email?: string;

  @Prop()
  phone?: string;
}

const SubscriptionBillingContactSchema = SchemaFactory.createForClass(SubscriptionBillingContact);

@Schema({ timestamps: true })
export class Subscription {
  @Prop({ required: true, unique: true })
  tenantId: string;

  @Prop({
    type: SubscriptionPlanSchema,
    required: true,
    default: {
      code: 'standard',
      name: 'Plano Standard',
      amount: 49900,
      currency: 'BRL',
      interval: 'monthly',
      seats: 10
    }
  })
  plan: SubscriptionPlan;

  @Prop({ required: true, enum: ['trial', 'active', 'past_due', 'suspended'], default: 'trial' })
  status: SubscriptionStatus;

  @Prop({ default: 1, min: 1, max: 28 })
  billingDay?: number;

  @Prop()
  trialEndsAt?: Date;

  @Prop()
  nextBillingAt?: Date;

  @Prop()
  graceUntil?: Date;

  @Prop({ type: SubscriptionBillingContactSchema, default: {} })
  billingContact?: SubscriptionBillingContact;

  @Prop({ enum: ['PIX', 'CARD_CREDIT', 'CARD_DEBIT', 'BANK_TRANSFER'], default: 'PIX' })
  preferredPaymentMethod?: SubscriptionPaymentMethod;

  @Prop({ default: 5 })
  reminderDays?: number;

  @Prop({ default: 5 })
  graceDays?: number;

  @Prop()
  suspendedAt?: Date;

  @Prop()
  suspendedReason?: string;
}

export type SubscriptionDocument = Subscription & Document;
export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);
SubscriptionSchema.index({ tenantId: 1 });
