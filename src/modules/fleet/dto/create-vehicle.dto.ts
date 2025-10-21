import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateVehicleDto {
  @IsString()
  @IsNotEmpty()
  plate: string;

  @IsString()
  @IsOptional()
  model?: string;

  @IsNumber()
  @IsOptional()
  year?: number;

  @IsString()
  @IsOptional()
  teamId?: string;

  @IsNumber()
  @IsOptional()
  odometer?: number;

  @IsString()
  @IsOptional()
  costCenter?: string;
}
