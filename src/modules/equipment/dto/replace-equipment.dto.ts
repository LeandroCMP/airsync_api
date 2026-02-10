import { IsDateString, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ReplaceNewEquipmentDto {
  @IsString()
  @IsOptional()
  clientId?: string;

  @IsString()
  @IsOptional()
  locationId?: string;

  @IsString()
  @IsOptional()
  brand?: string;

  @IsString()
  @IsOptional()
  model?: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsNumber({}, { message: 'BTUs deve ser um numero.' })
  @IsOptional()
  btus?: number;

  @IsDateString({}, { message: 'Data de instalacao deve ser AAAA-MM-DD.' })
  @IsOptional()
  installDate?: Date;

  @IsString()
  @IsOptional()
  serial?: string;

  @IsString()
  @IsOptional()
  room?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class ReplaceEquipmentDto {
  @ValidateNested()
  @Type(() => ReplaceNewEquipmentDto)
  newEquipment: ReplaceNewEquipmentDto;

  @IsString()
  @IsOptional()
  notes?: string;
}
