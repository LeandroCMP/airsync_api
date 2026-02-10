import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested
} from 'class-validator';

class SaleItemDto {
  @IsEnum(['product', 'service'])
  type: 'product' | 'service';

  @IsString()
  @IsOptional()
  inventoryItemId?: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  qty: number;

  @IsNumber()
  unitPrice: number;

  @IsBoolean()
  @IsOptional()
  requiresInstallation?: boolean;
}

class MoveRequestDto {
  @IsString()
  @IsNotEmpty()
  equipmentId: string;

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

export class CreateSaleDto {
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @IsString()
  @IsNotEmpty()
  locationId: string;

  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  @IsArray()
  items: SaleItemDto[];

  @IsNumber()
  @IsOptional()
  discount?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @ValidateNested()
  @Type(() => MoveRequestDto)
  @IsOptional()
  moveRequest?: MoveRequestDto;

  @IsBoolean()
  @IsOptional()
  autoCreateOrder?: boolean;
}
