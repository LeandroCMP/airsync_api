import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpdateClientDto {
  @IsString()
  @IsOptional()
  name?: string;

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
