import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateVehicleDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe a placa.' })
  plate: string;

  @IsString()
  @IsOptional()
  model?: string;

  @IsNumber({}, { message: 'Ano deve ser numerico.' })
  @IsOptional()
  year?: number;

  @IsString()
  @IsOptional()
  teamId?: string;

  @IsNumber({}, { message: 'Odometro deve ser numerico.' })
  @IsOptional()
  odometer?: number;
}
