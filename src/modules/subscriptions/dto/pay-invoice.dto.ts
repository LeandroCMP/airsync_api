import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { SubscriptionPaymentMethod } from '../subscription.schema';

export class PayInvoiceDto {
  @IsEnum(['PIX', 'CARD_CREDIT', 'CARD_DEBIT', 'BANK_TRANSFER'])
  method: SubscriptionPaymentMethod;

  @IsNumber()
  amount: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

