import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Equipment {
  @Prop({ required: true })
  tenantId: string;

  @Prop({ required: true })
  clientId: string;

  @Prop({ required: true })
  locationId: string;

  @Prop()
  brand?: string;

  @Prop()
  model?: string;

  @Prop()
  type?: string;

  @Prop()
  btus?: number;

  @Prop()
  installDate?: Date;

  @Prop()
  serial?: string;

  @Prop()
  room: string;

  @Prop()
  notes?: string;

  @Prop()
  lastServiceAt?: Date;

  @Prop()
  nextServiceAt?: Date;

  @Prop()
  updatedBy?: string;

  @Prop()
  replacedBy?: string;

  @Prop()
  replacedAt?: Date;

  @Prop({ default: null })
  deletedAt?: Date | null;
}

export type EquipmentDocument = Equipment & Document;
export const EquipmentSchema = SchemaFactory.createForClass(Equipment);
EquipmentSchema.index({ tenantId: 1, clientId: 1 });
EquipmentSchema.index({ tenantId: 1, locationId: 1 });
