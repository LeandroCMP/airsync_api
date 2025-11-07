import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateEquipmentDto {
  @IsString({ message: 'clientId must be a string' })
  @IsNotEmpty({ message: 'clientId is required' })
  clientId: string;

  @IsString({ message: 'locationId must be a string' })
  @IsNotEmpty({ message: 'locationId is required' })
  locationId: string;

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

  @IsString({ message: 'room must be a string' })
  @IsNotEmpty({ message: 'room is required' })
  room: string;

  @IsOptional()
  @IsString({ message: 'notes must be a string' })
  notes?: string;
}
