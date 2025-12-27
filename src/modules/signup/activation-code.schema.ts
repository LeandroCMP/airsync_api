import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class ActivationCode {
  @Prop({ required: true, unique: true })
  tenantId: string;

  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  phone: string;

  @Prop({ required: true })
  codeHash: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ default: 0 })
  attempts: number;
}

export type ActivationCodeDocument = ActivationCode & Document;
export const ActivationCodeSchema = SchemaFactory.createForClass(ActivationCode);
ActivationCodeSchema.index({ tenantId: 1 });
ActivationCodeSchema.index({ userId: 1 });
