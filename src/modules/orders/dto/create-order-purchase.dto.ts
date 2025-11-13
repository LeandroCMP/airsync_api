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

class OrderPurchaseItemDto {
  @IsString()
  @IsNotEmpty()
  itemId: string;

  @Type(() => Number)
  qty: number;

  @Type(() => Number)
  @IsNumber()
  unitCost: number;

  @IsString()
  @IsOptional()
  costCenterId?: string;
}

export class CreateOrderPurchaseDto {
  @IsString()
  @IsNotEmpty()
  supplierId: string;

  @IsEnum(['draft', 'pending', 'approved', 'ordered', 'received', 'canceled'])
  @IsOptional()
  status?: 'draft' | 'pending' | 'approved' | 'ordered' | 'received' | 'canceled';

  @ValidateNested({ each: true })
  @Type(() => OrderPurchaseItemDto)
  @IsArray()
  @IsOptional()
  items?: OrderPurchaseItemDto[];

  @IsNumber()
  @IsOptional()
  freight?: number;

  @IsDateString()
  @IsOptional()
  paymentDueDate?: Date;

  @IsNumber()
  @IsOptional()
  subtotal?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

