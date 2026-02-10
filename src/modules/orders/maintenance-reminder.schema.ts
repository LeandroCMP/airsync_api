import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MaintenanceReminderStatus = 'pending' | 'notified' | 'done' | 'void';

@Schema({ timestamps: true })
export class MaintenanceReminder {
  @Prop({ required: true })
  tenantId: string;

  @Prop({ required: true })
  equipmentId: string;

  @Prop({ required: true })
  orderId: string;

  @Prop({ required: true })
  serviceTypeCode: string;

  @Prop()
  serviceName?: string;

  @Prop({ required: true })
  nextDueAt: Date;

  @Prop({ default: 'pending' })
  status: MaintenanceReminderStatus;

  @Prop()
  notifiedAt?: Date;

  @Prop()
  scheduledAt?: Date;
}

export type MaintenanceReminderDocument = MaintenanceReminder & Document;
export const MaintenanceReminderSchema = SchemaFactory.createForClass(MaintenanceReminder);
MaintenanceReminderSchema.index({ tenantId: 1, equipmentId: 1, serviceTypeCode: 1 }, { unique: true });
MaintenanceReminderSchema.index({ tenantId: 1, status: 1, nextDueAt: 1 });
