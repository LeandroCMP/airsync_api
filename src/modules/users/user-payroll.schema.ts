import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PayrollStatus = 'pending' | 'paid';
export type PayrollPaymentMethod = 'PIX' | 'CASH' | 'CARD' | 'BANK_TRANSFER';

@Schema({ timestamps: true })
export class UserPayroll {
  @Prop({ required: true })
  tenantId: string;

  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  reference: string; // YYYY-MM ou período definido

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true, enum: ['pending', 'paid'], default: 'pending' })
  status: PayrollStatus;

  @Prop()
  dueDate?: Date;

  @Prop()
  paidAt?: Date;

  @Prop({ enum: ['PIX', 'CASH', 'CARD', 'BANK_TRANSFER'] })
  paymentMethod?: PayrollPaymentMethod;

  @Prop()
  notes?: string;

  @Prop()
  attachmentUrl?: string;

  @Prop()
  financeTransactionId?: string;

  @Prop()
  createdBy?: string;

  @Prop()
  updatedBy?: string;
}

export type UserPayrollDocument = UserPayroll & Document;
export const UserPayrollSchema = SchemaFactory.createForClass(UserPayroll);
UserPayrollSchema.index({ tenantId: 1, userId: 1, reference: 1 }, { unique: true });
