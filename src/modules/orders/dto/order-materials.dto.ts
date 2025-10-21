import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsString } from 'class-validator';

class OrderMaterialDto {
  @IsString()
  @IsNotEmpty()
  itemId: string;

  @Type(() => Number)
  qty: number;
}

export class OrderMaterialsDto {
  @IsArray()
  materials: OrderMaterialDto[];
}
