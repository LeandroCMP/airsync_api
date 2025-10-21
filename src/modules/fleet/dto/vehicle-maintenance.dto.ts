import { IsDateString, IsNumber, IsOptional, IsString } from 'class-validator';

export class VehicleMaintenanceDto {
  @IsString()
  type: string;

  @IsDateString()
  at: Date;

  @IsNumber()
  atKm: number;

  @IsNumber()
  cost: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
