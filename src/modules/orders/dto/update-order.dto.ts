import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';

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

  @Type(() => Number)
  qty: number;

  @Type(() => Number)
  unitPrice: number;
}

export class UpdateOrderDto {
  @IsEnum(['scheduled', 'in_progress', 'done', 'canceled'])
  @IsOptional()
  status?: 'scheduled' | 'in_progress' | 'done' | 'canceled';

  @IsDateString()
  @IsOptional()
  scheduledAt?: Date;

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
}
