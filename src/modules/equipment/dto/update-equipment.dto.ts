import { IsDateString, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateEquipmentDto {
  @IsOptional()
  @IsString({ message: 'brand must be a string' })
  brand?: string;

  @IsOptional()
  @IsString({ message: 'model must be a string' })
  model?: string;

  @IsOptional()
  @IsString({ message: 'type must be a string' })
  type?: string;

  @IsOptional()
  @IsNumber({}, { message: 'btus must be a number' })
  btus?: number;

  @IsOptional()
  @IsDateString({}, { message: 'installDate must be an ISO date (YYYY-MM-DD)' })
  installDate?: string;

  @IsOptional()
  @IsString({ message: 'serial must be a string' })
  serial?: string;

  @IsOptional()
  @IsString({ message: 'room must be a string' })
  room?: string;

  @IsOptional()
  @IsString({ message: 'notes must be a string' })
  notes?: string;

  @IsOptional()
  @IsDateString({}, { message: 'lastServiceAt must be an ISO date (YYYY-MM-DD)' })
  lastServiceAt?: string;

  @IsOptional()
  @IsDateString({}, { message: 'nextServiceAt must be an ISO date (YYYY-MM-DD)' })
  nextServiceAt?: string;
}
