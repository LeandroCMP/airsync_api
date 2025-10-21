import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Supplier {
  @Prop({ required: true })
  tenantId: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  docNumber?: string;

  @Prop()
  phone?: string;

  @Prop()
  email?: string;

  @Prop({ type: Object })
  address?: any;

  @Prop()
  notes?: string;

  @Prop({ default: null })
  deletedAt?: Date | null;
}

export type SupplierDocument = Supplier & Document;
export const SupplierSchema = SchemaFactory.createForClass(Supplier);
SupplierSchema.index({ tenantId: 1, name: 1 });
