import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class CostCenter {
  @Prop({ required: true })
  tenantId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  code: string;

  @Prop({ enum: ['operational', 'administrative', 'financial', 'other'], default: 'operational' })
  type: 'operational' | 'administrative' | 'financial' | 'other';

  @Prop()
  description?: string;

  @Prop({ default: true })
  active: boolean;
}

export type CostCenterDocument = CostCenter & Document;
export const CostCenterSchema = SchemaFactory.createForClass(CostCenter);
CostCenterSchema.index({ tenantId: 1, code: 1 }, { unique: true });
