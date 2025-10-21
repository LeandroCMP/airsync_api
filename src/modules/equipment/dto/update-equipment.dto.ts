import { IsDateString, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateEquipmentDto {
  @IsString()
  @IsOptional()
  brand?: string;

  @IsString()
  @IsOptional()
  model?: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsNumber()
  @IsOptional()
  btus?: number;

  @IsDateString()
  @IsOptional()
  installDate?: Date;

  @IsString()
  @IsOptional()
  serial?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsDateString()
  @IsOptional()
  lastServiceAt?: Date;

  @IsDateString()
  @IsOptional()
  nextServiceAt?: Date;
}
