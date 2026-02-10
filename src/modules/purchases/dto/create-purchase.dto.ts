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

class PurchaseItemDto {
  @IsString()
  @IsNotEmpty()
  itemId: string;

  @IsNumber()
  qty: number;

  @IsNumber()
  unitCost: number;

  @IsString()
  @IsOptional()
  orderId?: string;
}

export class CreatePurchaseDto {
  @IsString()
  @IsNotEmpty()
  supplierId: string;

  @IsEnum(['draft', 'pending', 'approved', 'ordered', 'received', 'canceled'])
  status: 'draft' | 'pending' | 'approved' | 'ordered' | 'received' | 'canceled';

  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  @IsArray()
  items: PurchaseItemDto[];

  @IsOptional()
  @IsNumber()
  freight?: number;

  @IsOptional()
  @IsDateString()
  paymentDueDate?: Date;

  @IsOptional()
  @IsNumber()
  subtotal?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
