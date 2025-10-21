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
}

const PurchaseItemSchema = SchemaFactory.createForClass(PurchaseItem);

@Schema({ timestamps: true })
export class Purchase {
  @Prop({ required: true })
  tenantId: string;

  @Prop({ required: true })
  supplierId: string;

  @Prop({ required: true, enum: ['draft', 'ordered', 'received', 'canceled'], default: 'draft' })
  status: 'draft' | 'ordered' | 'received' | 'canceled';

  @Prop({ type: [PurchaseItemSchema], default: [] })
  items: PurchaseItem[];

  @Prop({ type: Object, default: {} })
  totals: {
    subtotal: number;
    freight?: number;
    total: number;
  };

  @Prop()
  receivedAt?: Date;

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
