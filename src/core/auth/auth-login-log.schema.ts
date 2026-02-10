import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: { createdAt: 'at', updatedAt: false } })
export class AuthLoginLog {
  @Prop({ required: true })
  email: string;

  @Prop()
  tenantId?: string;

  @Prop()
  userId?: string;

  @Prop({ required: true })
  success: boolean;

  @Prop({ required: true })
  message: string;

  @Prop()
  ip?: string;

  @Prop()
  ua?: string;
}

export type AuthLoginLogDocument = AuthLoginLog & Document;
export const AuthLoginLogSchema = SchemaFactory.createForClass(AuthLoginLog);

