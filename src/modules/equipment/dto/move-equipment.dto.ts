import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class MoveEquipmentDto {
  @IsString()
  @IsOptional()
  toClientId?: string;

  @IsString()
  @IsNotEmpty({ message: 'Informe o local de destino.' })
  toLocationId: string;

  @IsString()
  @IsNotEmpty({ message: 'Informe o comodo/ambiente de destino.' })
  toRoom: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
