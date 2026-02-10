import { IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class AddressDto {
  @IsString()
  @IsOptional()
  street?: string;

  @IsString()
  @IsOptional()
  number?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @IsOptional()
  zip?: string;
}

class GeoDto {
  @Type(() => Number)
  lat: number;

  @Type(() => Number)
  lng: number;
}

export class UpdateLocationDto {
  @IsString()
  @IsOptional()
  label?: string;

  @ValidateNested()
  @Type(() => AddressDto)
  @IsOptional()
  address?: AddressDto;

  @ValidateNested()
  @Type(() => GeoDto)
  @IsOptional()
  geo?: GeoDto;

  @IsString()
  @IsOptional()
  notes?: string;
}
