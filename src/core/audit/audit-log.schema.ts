import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: { createdAt: 'at', updatedAt: false } })
export class AuditLog {
  @Prop({ required: true })
  tenantId: string;

  @Prop({ required: true })
  entity: string;

  @Prop({ required: true })
  entityId: string;

  @Prop({ required: true, enum: ['create', 'update', 'delete'] })
  action: 'create' | 'update' | 'delete';

  @Prop({ type: Object })
  before?: any;

  @Prop({ type: Object })
  after?: any;

  @Prop({ required: true })
  by: string;

  @Prop()
  ip?: string;
}

export type AuditLogDocument = AuditLog & Document;
export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
