import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateEquipmentDto {
  @IsString({ message: 'Informe o cliente.' })
  @IsNotEmpty({ message: 'Informe o cliente.' })
  clientId: string;

  @IsString({ message: 'Informe o local.' })
  @IsNotEmpty({ message: 'Informe o local.' })
  locationId: string;

  @IsOptional()
  @IsString({ message: 'Marca deve ser texto.' })
  brand?: string;

  @IsOptional()
  @IsString({ message: 'Modelo deve ser texto.' })
  model?: string;

  @IsOptional()
  @IsString({ message: 'Tipo deve ser texto.' })
  type?: string;

  @IsOptional()
  @IsNumber({}, { message: 'BTUs deve ser um numero.' })
  btus?: number;

  @IsOptional()
  @IsDateString({}, { message: 'Data de instalacao deve ser AAAA-MM-DD.' })
  installDate?: string;

  @IsOptional()
  @IsString({ message: 'Numero de serie deve ser texto.' })
  serial?: string;

  @IsString({ message: 'Informe o ambiente/comodo.' })
  @IsNotEmpty({ message: 'Informe o ambiente/comodo.' })
  room: string;

  @IsOptional()
  @IsString({ message: 'Observacoes devem ser texto.' })
  notes?: string;
}
