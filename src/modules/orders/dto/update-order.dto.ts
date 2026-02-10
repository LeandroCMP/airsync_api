import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested
} from 'class-validator';

class ChecklistItemDto {
  @IsString()
  item: string;

  @IsOptional()
  done?: boolean;

  @IsOptional()
  note?: string;

  @IsOptional()
  photoUrls?: string[];
}

class BillingItemDto {
  @IsEnum(['service', 'part'])
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

export class UpdateOrderDto {
  @IsEnum(['scheduled', 'in_progress', 'done', 'canceled'])
  @IsOptional()
  status?: 'scheduled' | 'in_progress' | 'done' | 'canceled';

  @IsDateString()
  @IsOptional()
  scheduledAt?: string;

  @IsArray()
  @IsOptional()
  technicianIds?: string[];

  @ValidateNested({ each: true })
  @Type(() => ChecklistItemDto)
  @IsArray()
  @IsOptional()
  checklist?: ChecklistItemDto[];

  @ValidateNested({ each: true })
  @Type(() => BillingItemDto)
  @IsArray()
  @IsOptional()
  billingItems?: BillingItemDto[];

  @Type(() => Number)
  @IsOptional()
  billingDiscount?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  saleId?: string;
}
