import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';

class BillingItemDto {
  @IsString()
  type: 'service' | 'part';

  @IsString()
  name: string;

  @Type(() => Number)
  qty: number;

  @Type(() => Number)
  unitPrice: number;
}

export class FinishOrderDto {
  @ValidateNested({ each: true })
  @Type(() => BillingItemDto)
  @IsArray()
  @IsOptional()
  billingItems?: BillingItemDto[];

  @Type(() => Number)
  @IsOptional()
  discount?: number;

  @IsString()
  @IsOptional()
  signatureBase64?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
