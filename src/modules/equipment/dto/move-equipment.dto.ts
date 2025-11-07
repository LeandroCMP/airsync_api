import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class MoveEquipmentDto {
  @IsString()
  @IsOptional()
  toClientId?: string;

  @IsString()
  @IsNotEmpty()
  toLocationId: string;

  @IsString()
  @IsNotEmpty()
  toRoom: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

