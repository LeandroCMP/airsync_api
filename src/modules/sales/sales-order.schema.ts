import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SaleItemType = 'product' | 'service';

@Schema()
export class SaleItem {
  @Prop({ required: true, enum: ['product', 'service'] })
  type: SaleItemType;

  @Prop()
  inventoryItemId?: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  qty: number;

  @Prop({ required: true })
  unitPrice: number;

  @Prop({ default: false })
  requiresInstallation: boolean;
}

const SaleItemSchema = SchemaFactory.createForClass(SaleItem);

@Schema()
export class SaleHistoryEntry {
  @Prop({ required: true })
  status: string;

  @Prop({ default: Date.now })
  at: Date;

  @Prop()
  by?: string;

  @Prop()
  note?: string;
}

const SaleHistoryEntrySchema = SchemaFactory.createForClass(SaleHistoryEntry);

@Schema()
export class SaleMoveRequest {
  @Prop({ required: true })
  equipmentId: string;

  @Prop()
  toClientId?: string;

  @Prop({ required: true })
  toLocationId: string;

  @Prop({ required: true })
  toRoom: string;

  @Prop()
  notes?: string;
}

const SaleMoveRequestSchema = SchemaFactory.createForClass(SaleMoveRequest);

@Schema({ timestamps: true })
export class SaleOrder {
  @Prop({ required: true })
  tenantId: string;

  @Prop({ required: true })
  clientId: string;

  @Prop({ required: true })
  locationId: string;

  @Prop({ enum: ['draft', 'quoted', 'approved', 'in_progress', 'fulfilled', 'canceled'], default: 'draft' })
  status: 'draft' | 'quoted' | 'approved' | 'in_progress' | 'fulfilled' | 'canceled';

  @Prop({ type: [SaleItemSchema], default: [] })
  items: SaleItem[];

  @Prop({ type: Object, default: { subtotal: 0, discount: 0, total: 0 } })
  totals: {
    subtotal: number;
    discount: number;
    total: number;
  };

  @Prop()
  costCenterId?: string;

  @Prop({ default: false })
  installationRequired: boolean;

  @Prop({ default: false })
  autoCreateOrder: boolean;

  @Prop({ type: SaleMoveRequestSchema })
  moveRequest?: SaleMoveRequest;

  @Prop()
  linkedOrderId?: string;

  @Prop()
  financeTransactionId?: string;

  @Prop()
  notes?: string;

  @Prop({ type: [SaleHistoryEntrySchema], default: [] })
  history: SaleHistoryEntry[];

  @Prop({ default: null })
  deletedAt?: Date | null;
}

export type SaleOrderDocument = SaleOrder & Document;
export const SaleOrderSchema = SchemaFactory.createForClass(SaleOrder);
SaleOrderSchema.index({ tenantId: 1, status: 1, clientId: 1 });
