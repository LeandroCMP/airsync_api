import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

class OrderMaterialDto {
  @IsString()
  @IsNotEmpty()
  itemId: string;

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

export class OrderMaterialsDto {
  @IsArray()
  materials: OrderMaterialDto[];
}
