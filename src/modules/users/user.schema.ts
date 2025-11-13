import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserRole = 'owner' | 'admin' | 'manager' | 'tech' | 'viewer';

@Schema()
export class UserCompensation {
  @Prop()
  salary?: number;

  @Prop()
  paymentDay?: number;

  @Prop({ enum: ['monthly', 'biweekly', 'weekly'] })
  paymentFrequency?: 'monthly' | 'biweekly' | 'weekly';

  @Prop({ enum: ['PIX', 'CASH', 'CARD', 'BANK_TRANSFER'] })
  paymentMethod?: 'PIX' | 'CASH' | 'CARD' | 'BANK_TRANSFER';

  @Prop()
  notes?: string;
}

const UserCompensationSchema = SchemaFactory.createForClass(UserCompensation);

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ required: true, enum: ['owner', 'admin', 'manager', 'tech', 'viewer'], default: 'viewer' })
  role: UserRole;

  @Prop({ type: [String], default: [] })
  permissions: string[];

  @Prop()
  hourlyCost?: number;

  @Prop({ type: UserCompensationSchema, default: {} })
  compensation?: UserCompensation;

  @Prop({ default: true })
  active: boolean;

  @Prop()
  updatedBy?: string;

  @Prop()
  deletedAt?: Date | null;
}

export type UserDocument = User & Document;

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ tenantId: 1, email: 1 }, { unique: true, partialFilterExpression: { deletedAt: null } });
// Enforce global unique emails across tenants (active users only)
UserSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { deletedAt: null } });
