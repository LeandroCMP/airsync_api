import { IsDateString, IsDefined, IsEnum, IsInt, IsNumber, Min } from 'class-validator';
import { FuelType } from './fuel-type.enum';

export class VehicleFuelDto {
  @IsDateString()
  at: string;

  @IsInt()
  @Min(0)
  km: number;

  @IsNumber()
  @Min(0.01)
  liters: number;

  @IsEnum(FuelType)
  @IsDefined()
  fuelType: FuelType;

  @IsNumber()
  @Min(0.01)
  cost: number;
}
