import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested
} from 'class-validator';

class ChecklistItemDto {
  @IsString()
  @IsNotEmpty()
  item: string;
}

class MaterialDto {
  @IsString()
  @IsNotEmpty()
  itemId: string;

  @IsNumber()
  @Type(() => Number)
  qty: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  unitCost?: number;

  @IsString()
  @IsOptional()
  itemName?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

class BillingItemDto {
  @IsEnum(['service', 'part'])
  type: 'service' | 'part';

  @IsString()
  name: string;

  @IsNumber()
  @Type(() => Number)
  qty: number;

  @IsNumber()
  @Type(() => Number)
  unitPrice: number;
}

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @IsString()
  @IsNotEmpty()
  locationId: string;

  @IsString()
  @IsOptional()
  equipmentId?: string;

  @IsString()
  @IsOptional()
  costCenterId?: string;

  @IsString()
  @IsOptional()
  saleId?: string;

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
  @Type(() => MaterialDto)
  @IsArray()
  @IsOptional()
  materials?: MaterialDto[];

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

