import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class ServiceType {
  @Prop({ required: true })
  tenantId: string;

  @Prop({ required: true })
  code: string;

  @Prop({ required: true })
  name: string;

  @Prop({ default: 90 })
  defaultIntervalDays: number;

  @Prop()
  defaultIntervalKm?: number;

  @Prop({ default: true })
  customizable?: boolean;

  @Prop({ default: true })
  active?: boolean;

  @Prop()
  notes?: string;
}

export type ServiceTypeDocument = ServiceType & Document;
export const ServiceTypeSchema = SchemaFactory.createForClass(ServiceType);
ServiceTypeSchema.index({ tenantId: 1, code: 1 }, { unique: true });
