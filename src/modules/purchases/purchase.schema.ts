import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class PurchaseItem {
  @Prop({ required: true })
  itemId: string;

  @Prop({ required: true })
  qty: number;

  @Prop({ required: true })
  unitCost: number;

  @Prop()
  orderId?: string;

  @Prop()
  costCenterId?: string;
}

const PurchaseItemSchema = SchemaFactory.createForClass(PurchaseItem);

@Schema()
export class PurchaseAlert {
  @Prop({ required: true })
  type: 'cost';

  @Prop({ required: true })
  itemId: string;

  @Prop({ required: true })
  message: string;

  @Prop()
  deltaPercent?: number;
}

const PurchaseAlertSchema = SchemaFactory.createForClass(PurchaseAlert);

@Schema()
export class PurchaseClassification {
  @Prop()
  categoryId?: string;

  @Prop()
  categoryName?: string;

  @Prop({ required: true })
  total: number;
}

const PurchaseClassificationSchema = SchemaFactory.createForClass(PurchaseClassification);

@Schema()
export class PurchaseHistoryEntry {
  @Prop({ required: true })
  status: string;

  @Prop({ required: true, default: Date.now })
  at: Date;

  @Prop()
  by?: string;

  @Prop()
  note?: string;
}

const PurchaseHistoryEntrySchema = SchemaFactory.createForClass(PurchaseHistoryEntry);

@Schema({ timestamps: true })
export class Purchase {
  @Prop({ required: true })
  tenantId: string;

  @Prop({ required: true })
  supplierId: string;

  @Prop({
    required: true,
    enum: ['draft', 'pending', 'approved', 'ordered', 'received', 'canceled'],
    default: 'draft'
  })
  status: 'draft' | 'pending' | 'approved' | 'ordered' | 'received' | 'canceled';

  @Prop({ type: [PurchaseItemSchema], default: [] })
  items: PurchaseItem[];

  @Prop({ type: Object, default: {} })
  totals: {
    subtotal: number;
    freight?: number;
    total: number;
  };

  @Prop()
  paymentDueDate?: Date;

  @Prop()
  financeTransactionId?: string;

  @Prop({ type: [PurchaseAlertSchema], default: [] })
  alerts: PurchaseAlert[];

  @Prop({ type: [PurchaseClassificationSchema], default: [] })
  classifications: PurchaseClassification[];

  @Prop()
  submittedAt?: Date;

  @Prop()
  approvedAt?: Date;

  @Prop()
  approvedBy?: string;

  @Prop()
  orderedAt?: Date;

  @Prop({ type: [PurchaseHistoryEntrySchema], default: [] })
  history: PurchaseHistoryEntry[];

  @Prop()
  receivedAt?: Date;

  @Prop()
  canceledAt?: Date;

  @Prop()
  notes?: string;

  @Prop()
  updatedBy?: string;

  @Prop({ default: null })
  deletedAt?: Date | null;
}

export type PurchaseDocument = Purchase & Document;
export const PurchaseSchema = SchemaFactory.createForClass(Purchase);
PurchaseSchema.index({ tenantId: 1, supplierId: 1 });
