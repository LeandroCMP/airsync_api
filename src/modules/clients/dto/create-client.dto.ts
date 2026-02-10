import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateClientDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome do cliente.' })
  name: string;

  @IsString()
  @IsOptional()
  docNumber?: string;

  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : value ? [value] : []))
  phones?: string[] | string;

  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : value ? [value] : []))
  emails?: string[] | string;

  @IsString()
  @IsOptional()
  notes?: string;
}
