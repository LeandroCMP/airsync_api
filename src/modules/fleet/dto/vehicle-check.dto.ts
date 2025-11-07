import { IsDate, IsNumber, IsOptional, IsString } from 'class-validator';

export class VehicleCheckDto {
  @IsDate()
  at: Date;

  @IsNumber()
  km: number;

  @IsNumber()
  fuelLevel: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
