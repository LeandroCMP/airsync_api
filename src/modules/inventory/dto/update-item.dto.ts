import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateInventoryItemDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  unit?: string;

  @IsNumber()
  @IsOptional()
  minQty?: number;

  @IsNumber()
  @IsOptional()
  maxQty?: number;

  @IsString()
  @IsOptional()
  supplierId?: string;

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsNumber()
  @IsOptional()
  avgCost?: number;

  @IsNumber()
  @IsOptional()
  sellPrice?: number;

  @IsNumber()
  @IsOptional()
  markupPercent?: number;

  @IsEnum(['manual', 'category'], { message: 'Modo de precificacao deve ser manual ou category.' })
  @IsOptional()
  pricingMode?: 'manual' | 'category';
}
