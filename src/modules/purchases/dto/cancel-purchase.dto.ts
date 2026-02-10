import { IsOptional, IsString } from 'class-validator';

export class CancelPurchaseDto {
  @IsString()
  @IsOptional()
  reason?: string;
}

