import { IsEmail, IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { SubscriptionPaymentMethod } from '../subscription.schema';

export class UpdateSubscriptionDto {
  @IsNumber()
  @Min(1)
  @Max(28)
  @IsOptional()
  billingDay?: number;

  @IsString()
  @IsOptional()
  billingContactName?: string;

  @IsEmail()
  @IsOptional()
  billingContactEmail?: string;

  @IsString()
  @IsOptional()
  billingContactPhone?: string;

  @IsEnum(['PIX', 'CARD_CREDIT', 'CARD_DEBIT', 'BANK_TRANSFER'])
  @IsOptional()
  preferredPaymentMethod?: SubscriptionPaymentMethod;
}
