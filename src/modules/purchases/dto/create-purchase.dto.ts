import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

class PurchaseItemDto {
  @IsString()
  @IsNotEmpty()
  itemId: string;

  @IsNumber()
  qty: number;

  @IsNumber()
  unitCost: number;
}

export class CreatePurchaseDto {
  @IsString()
  @IsNotEmpty()
  supplierId: string;

  @IsEnum(['draft', 'ordered', 'received', 'canceled'])
  status: 'draft' | 'ordered' | 'received' | 'canceled';

  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  @IsArray()
  items: PurchaseItemDto[];

  @IsOptional()
  @IsNumber()
  freight?: number;

  @IsOptional()
  @IsNumber()
  subtotal?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
