import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
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

  @Type(() => Number)
  qty: number;
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

  @IsEnum(['scheduled', 'in_progress', 'done', 'canceled'])
  status: 'scheduled' | 'in_progress' | 'done' | 'canceled';

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
