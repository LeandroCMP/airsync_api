import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FinancePaymentMethod =
  | 'PIX'
  | 'CASH'
  | 'CARD'
  | 'CARD_CREDIT'
  | 'CARD_DEBIT'
  | 'BANK_TRANSFER'
  | 'CHEQUE';

@Schema()
export class FinancePayment {
  @Prop({ required: true, enum: ['PIX', 'CASH', 'CARD', 'CARD_CREDIT', 'CARD_DEBIT', 'BANK_TRANSFER', 'CHEQUE'] })
  method: FinancePaymentMethod;

  @Prop({ required: true })
  amount: number;

  @Prop({ default: Date.now })
  at: Date;

  @Prop()
  txid?: string;

  @Prop()
  idempotencyKey?: string;
}

const FinancePaymentSchema = SchemaFactory.createForClass(FinancePayment);

@Schema()
export class FinanceInstallment {
  @Prop({ required: true })
  number: number;

  @Prop({ required: true })
  dueDate: Date;

  @Prop({ required: true })
  amount: number;

  @Prop({ default: 'BRL' })
  currency?: string;

  @Prop({ default: false })
  paid: boolean;

  @Prop({ type: [FinancePaymentSchema], default: [] })
  payments: FinancePayment[];
}

const FinanceInstallmentSchema = SchemaFactory.createForClass(FinanceInstallment);

@Schema({ timestamps: true })
export class FinanceTransaction {
  @Prop({ required: true })
  tenantId: string;

  @Prop({ required: true, enum: ['receivable', 'payable'] })
  type: 'receivable' | 'payable';

  @Prop({ required: true })
  ref: string;

  @Prop()
  partyId?: string;

  @Prop({ required: true })
  category: string;

  @Prop()
  description?: string;

  @Prop({ required: true })
  dueDate: Date;

  @Prop({ required: true })
  amount: number;

  @Prop({ default: false })
  paid: boolean;

  @Prop({ type: [FinanceInstallmentSchema], default: [] })
  installments?: FinanceInstallment[];

  @Prop({ type: [FinancePaymentSchema], default: [] })
  payments: FinancePayment[];

  @Prop()
  updatedBy?: string;
}

export type FinanceTransactionDocument = FinanceTransaction & Document;
export const FinanceTransactionSchema = SchemaFactory.createForClass(FinanceTransaction);
FinanceTransactionSchema.index({ tenantId: 1, type: 1, dueDate: 1 });
FinanceTransactionSchema.index({ tenantId: 1, paid: 1 });
FinanceTransactionSchema.index({ tenantId: 1, ref: 1 }, { unique: true, sparse: true });
