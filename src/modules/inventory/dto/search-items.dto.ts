import { IsEnum, IsMongoId, IsOptional, IsString } from 'class-validator';

export enum StockStatusFilter {
  ALL = 'all',
  BELOW_MINIMUM = 'below_minimum',
  CRITICAL = 'critical'
}

export class SearchInventoryItemsDto {
  @IsString()
  @IsOptional()
  text?: string;

  @IsMongoId()
  @IsOptional()
  itemId?: string;

  @IsString()
  @IsOptional()
  sku?: string;

  @IsEnum(StockStatusFilter)
  @IsOptional()
  stockStatus?: StockStatusFilter;
}

