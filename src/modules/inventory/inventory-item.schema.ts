import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type InventoryEntryType = 'in' | 'out' | 'reserve' | 'release';

@Schema()
export class InventoryEntry {
  @Prop({ required: true })
  type: InventoryEntryType;

  @Prop({ required: true })
  qty: number;

  @Prop()
  cost?: number;

  @Prop({ default: Date.now })
  at: Date;

  @Prop()
  ref?: string;

  @Prop()
  lot?: string;
}

const InventoryEntrySchema = SchemaFactory.createForClass(InventoryEntry);

@Schema({ timestamps: true })
export class InventoryItem {
  @Prop({ required: true })
  tenantId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  sku: string;

  @Prop()
  barcode?: string;

  @Prop({ default: 'un' })
  unit: string;

  @Prop({ default: 0 })
  minQty: number;

  @Prop()
  maxQty?: number;

  @Prop()
  supplierId?: string;

  @Prop()
  avgCost?: number;

  @Prop()
  sellPrice?: number;

  @Prop({ type: [InventoryEntrySchema], default: [] })
  entries: InventoryEntry[];

  @Prop({ default: 0 })
  onHand: number;

  @Prop({ default: 0 })
  reserved: number;

  @Prop()
  updatedBy?: string;

  @Prop({ default: null })
  deletedAt?: Date | null;
}

export type InventoryItemDocument = InventoryItem & Document;
export const InventoryItemSchema = SchemaFactory.createForClass(InventoryItem);
InventoryItemSchema.index({ tenantId: 1, sku: 1 }, { unique: true, partialFilterExpression: { deletedAt: null } });
InventoryItemSchema.index({ tenantId: 1, barcode: 1 });
