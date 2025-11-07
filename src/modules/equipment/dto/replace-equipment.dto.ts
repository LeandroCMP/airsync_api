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

  @IsNumber()
  @IsOptional()
  btus?: number;

  @IsDateString()
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
