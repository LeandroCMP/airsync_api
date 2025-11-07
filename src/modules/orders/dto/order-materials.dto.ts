import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

class OrderMaterialDto {
  @IsString()
  @IsNotEmpty()
  itemId: string;

  @Type(() => Number)
  qty: number;

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
