import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { OrderPaymentMethod } from '../order.schema';

class BillingItemDto {
  @IsString()
  type: 'service' | 'part';

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  serviceTypeCode?: string;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  nextMaintenanceInDays?: number;

  @IsNumber()
  @Type(() => Number)
  qty: number;

  @IsNumber()
  @Type(() => Number)
  unitPrice: number;
}

class PaymentDto {
  @IsEnum(['PIX', 'CASH', 'CARD_CREDIT', 'CARD_DEBIT', 'CHEQUE'])
  method: OrderPaymentMethod;

  @IsNumber()
  @Type(() => Number)
  amount: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  installments?: number;
}

export class FinishOrderDto {
  @ValidateNested({ each: true })
  @Type(() => BillingItemDto)
  @IsArray()
  @IsOptional()
  billingItems?: BillingItemDto[];

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  discount?: number;

  @ValidateNested({ each: true })
  @Type(() => PaymentDto)
  @IsArray()
  payments: PaymentDto[];

  @IsString()
  @IsOptional()
  signatureBase64?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
