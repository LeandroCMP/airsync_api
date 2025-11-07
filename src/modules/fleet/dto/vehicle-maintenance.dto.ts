import { IsDate, IsNumber, IsOptional, IsString } from 'class-validator';

export class VehicleMaintenanceDto {
  @IsString()
  type: string;

  @IsDate()
  at: Date;

  @IsNumber()
  atKm: number;

  @IsNumber()
  cost: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
