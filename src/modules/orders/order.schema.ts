import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class OrderChecklistItem {
  @Prop({ required: true })
  item: string;

  @Prop({ default: false })
  done: boolean;

  @Prop()
  note?: string;

  @Prop({ type: [String], default: [] })
  photoUrls: string[];
}

const OrderChecklistItemSchema = SchemaFactory.createForClass(OrderChecklistItem);

@Schema()
export class OrderMaterial {
  @Prop({ required: true })
  itemId: string;

  @Prop({ required: true })
  qty: number;

  @Prop()
  unitCost?: number;

  @Prop()
  itemName?: string;

  @Prop()
  description?: string;

  @Prop({ default: false })
  reserved: boolean;

  @Prop()
  deductedAt?: Date;
}

const OrderMaterialSchema = SchemaFactory.createForClass(OrderMaterial);

@Schema()
export class BillingItem {
  @Prop({ required: true, enum: ['service', 'part'] })
  type: 'service' | 'part';

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  qty: number;

  @Prop({ required: true })
  unitPrice: number;
}

const BillingItemSchema = SchemaFactory.createForClass(BillingItem);

@Schema()
export class OrderBilling {
  @Prop({ type: [BillingItemSchema], default: [] })
  items: BillingItem[];

  @Prop({ default: 0 })
  subtotal: number;

  @Prop({ default: 0 })
  discount: number;

  @Prop({ default: 0 })
  total: number;

  @Prop({ default: 'pending' })
  status: 'pending' | 'partial' | 'paid';
}

const OrderBillingSchema = SchemaFactory.createForClass(OrderBilling);

export type OrderPaymentMethod = 'PIX' | 'CASH' | 'CARD_CREDIT' | 'CARD_DEBIT' | 'CHEQUE';

@Schema()
export class OrderPayment {
  @Prop({ required: true, enum: ['PIX', 'CASH', 'CARD_CREDIT', 'CARD_DEBIT', 'CHEQUE'] })
  method: OrderPaymentMethod;

  @Prop({ required: true })
  amount: number;

  @Prop()
  installments?: number;

  @Prop({ default: 0 })
  feePercent: number;

  @Prop({ default: 0 })
  feeValue: number;

  @Prop({ default: 0 })
  netAmount: number;
}

const OrderPaymentSchema = SchemaFactory.createForClass(OrderPayment);

@Schema({ timestamps: true })
export class Order {
  @Prop({ required: true })
  tenantId: string;

  @Prop({ required: true })
  clientId: string;

  @Prop({ required: true })
  locationId: string;

  @Prop()
  equipmentId?: string;

  @Prop({ required: true, enum: ['scheduled', 'in_progress', 'done', 'canceled'], default: 'scheduled' })
  status: 'scheduled' | 'in_progress' | 'done' | 'canceled';

  @Prop()
  scheduledAt?: Date;

  @Prop()
  startedAt?: Date;

  @Prop()
  finishedAt?: Date;

  @Prop({ type: [String], default: [] })
  technicianIds: string[];

  @Prop({ type: [OrderChecklistItemSchema], default: [] })
  checklist: OrderChecklistItem[];

  @Prop({ type: [OrderMaterialSchema], default: [] })
  materials: OrderMaterial[];

  @Prop({ type: Object, default: {} })
  timesheet: {
    start?: Date;
    end?: Date;
    totalMin?: number;
  };

  @Prop({ type: [String], default: [] })
  photoUrls: string[];

  @Prop()
  customerSignatureUrl?: string;

  @Prop()
  notes?: string;

  @Prop({ type: OrderBillingSchema, default: {} })
  billing: OrderBilling;

  @Prop({ type: [OrderPaymentSchema], default: [] })
  payments: OrderPayment[];

  @Prop({ default: 0 })
  paymentGrossTotal?: number;

  @Prop({ default: 0 })
  paymentFeeTotal?: number;

  @Prop({ default: 0 })
  paymentNetTotal?: number;

  @Prop()
  costCenterId?: string;

  @Prop()
  saleId?: string;

  @Prop({ type: Object, default: {} })
  costs?: {
    materials?: number;
    labor?: number;
    overhead?: number;
    purchases?: number;
    total?: number;
  };

  @Prop({ type: [String], default: [] })
  costCenters?: string[];

  @Prop()
  financeTransactionId?: string;

  @Prop({ type: Object, default: {} })
  audit: {
    createdBy?: string;
    updatedBy?: string;
  };

  @Prop({ default: null })
  deletedAt?: Date | null;
}

export type OrderDocument = Order & Document;
export const OrderSchema = SchemaFactory.createForClass(Order);
OrderSchema.index({ tenantId: 1, status: 1, scheduledAt: 1 });
OrderSchema.index({ tenantId: 1, technicianIds: 1, scheduledAt: 1 });
