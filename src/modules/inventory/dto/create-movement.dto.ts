import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateInventoryMovementDto {
  @IsString()
  @IsNotEmpty()
  itemId: string;

  @IsEnum(['in', 'out', 'reserve', 'release'])
  type: 'in' | 'out' | 'reserve' | 'release';

  @IsNumber()
  qty: number;

  @IsNumber()
  @IsOptional()
  cost?: number;

  @IsString()
  @IsOptional()
  ref?: string;

  @IsString()
  @IsOptional()
  lot?: string;
}
