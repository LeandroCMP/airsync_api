import { IsEmail, IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { SubscriptionPaymentMethod } from '../subscription.schema';

export class UpdateSubscriptionDto {
  @IsString()
  @IsOptional()
  planCode?: string;

  @IsString()
  @IsOptional()
  planName?: string;

  @IsNumber()
  @IsOptional()
  amount?: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsEnum(['monthly', 'annual'])
  @IsOptional()
  interval?: 'monthly' | 'annual';

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

