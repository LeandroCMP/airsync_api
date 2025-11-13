import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class InventoryCategory {
  @Prop({ required: true })
  tenantId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ default: 0 })
  markupPercent: number;

  @Prop()
  description?: string;
}

export type InventoryCategoryDocument = InventoryCategory & Document;
export const InventoryCategorySchema = SchemaFactory.createForClass(InventoryCategory);
InventoryCategorySchema.index({ tenantId: 1, name: 1 }, { unique: true });

