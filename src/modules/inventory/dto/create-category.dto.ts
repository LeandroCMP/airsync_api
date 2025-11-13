import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateInventoryCategoryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @IsOptional()
  markupPercent?: number;

  @IsString()
  @IsOptional()
  description?: string;
}

