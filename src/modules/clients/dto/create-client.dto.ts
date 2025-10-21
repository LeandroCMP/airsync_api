import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString
} from 'class-validator';

export class CreateClientDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  docNumber?: string;

  @IsArray()
  @IsOptional()
  phones?: string[];

  @IsArray()
  @IsOptional()
  emails?: string[];

  @IsArray()
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  notes?: string;
}
