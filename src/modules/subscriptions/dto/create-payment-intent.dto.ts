import { IsIn, IsOptional, IsString } from 'class-validator';
import { SubscriptionPaymentMethod } from '../subscription.schema';

export class CreatePaymentIntentDto {
  @IsIn(['PIX', 'CARD_CREDIT', 'CARD_DEBIT', 'BANK_TRANSFER'])
  @IsOptional()
  method?: SubscriptionPaymentMethod;

  @IsString()
  @IsOptional()
  successUrl?: string;

  @IsString()
  @IsOptional()
  cancelUrl?: string;
}
