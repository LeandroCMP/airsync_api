import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateServiceTypeDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @IsOptional()
  defaultIntervalDays?: number;

  @IsNumber()
  @IsOptional()
  defaultIntervalKm?: number;

  @IsBoolean()
  @IsOptional()
  customizable?: boolean;

  @IsBoolean()
  @IsOptional()
  active?: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateServiceTypeDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber()
  @IsOptional()
  defaultIntervalDays?: number;

  @IsNumber()
  @IsOptional()
  defaultIntervalKm?: number;

  @IsBoolean()
  @IsOptional()
  customizable?: boolean;

  @IsBoolean()
  @IsOptional()
  active?: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}
