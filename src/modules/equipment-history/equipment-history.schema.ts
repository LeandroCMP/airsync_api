import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class EquipmentHistory {
  @Prop({ required: true })
  tenantId: string;

  @Prop({ required: true })
  equipmentId: string;

  @Prop()
  orderId?: string;

  @Prop({ required: true, enum: ['order_created', 'order_finished', 'order_rescheduled', 'moved', 'replaced'] })
  type: 'order_created' | 'order_finished' | 'order_rescheduled' | 'moved' | 'replaced';

  @Prop({ required: true })
  at: Date;

  @Prop()
  notes?: string;

  @Prop()
  by?: string;

  @Prop({ type: Object })
  meta?: any;
}

export type EquipmentHistoryDocument = EquipmentHistory & Document;
export const EquipmentHistorySchema = SchemaFactory.createForClass(EquipmentHistory);
EquipmentHistorySchema.index({ tenantId: 1, equipmentId: 1, at: 1 });
