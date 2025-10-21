import { IsDateString, IsNumber } from 'class-validator';

export class VehicleFuelDto {
  @IsDateString()
  at: Date;

  @IsNumber()
  km: number;

  @IsNumber()
  liters: number;

  @IsNumber()
  cost: number;
}
