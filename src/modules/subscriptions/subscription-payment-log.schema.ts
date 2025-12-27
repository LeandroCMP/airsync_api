import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SubscriptionPaymentLogType =
  | 'intent_created'
  | 'intent_confirmed'
  | 'webhook_succeeded'
  | 'webhook_succeeded_invoice_missing'
  | 'webhook_failed'
  | 'webhook_failed_invoice_missing'
  | 'manual_payment'
  | 'manual_failure';

@Schema({ timestamps: true })
export class SubscriptionPaymentLog {
  @Prop({ required: true })
  tenantId: string;

  @Prop()
  invoiceId?: string;

  @Prop({ required: true })
  type: SubscriptionPaymentLogType;

  @Prop()
  status?: string;

  @Prop({ type: Object })
  payload?: Record<string, any>;

  @Prop()
  errorMessage?: string;
}

export type SubscriptionPaymentLogDocument = SubscriptionPaymentLog & Document;
export const SubscriptionPaymentLogSchema = SchemaFactory.createForClass(SubscriptionPaymentLog);
SubscriptionPaymentLogSchema.index({ tenantId: 1, createdAt: -1 });
