import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserRole = 'admin' | 'manager' | 'tech' | 'viewer';

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

  @Prop({ required: true, enum: ['admin', 'manager', 'tech', 'viewer'], default: 'viewer' })
  role: UserRole;

  @Prop({ type: [String], default: [] })
  permissions: string[];

  @Prop()
  hourlyCost?: number;

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
