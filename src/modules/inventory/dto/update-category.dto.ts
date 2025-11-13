import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateInventoryCategoryDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber()
  @IsOptional()
  markupPercent?: number;

  @IsString()
  @IsOptional()
  description?: string;
}

