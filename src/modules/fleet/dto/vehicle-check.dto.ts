import { IsDateString, IsNumber, IsOptional, IsString } from 'class-validator';

export class VehicleCheckDto {
  @IsDateString()
  at: Date;

  @IsNumber()
  km: number;

  @IsNumber()
  fuelLevel: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
