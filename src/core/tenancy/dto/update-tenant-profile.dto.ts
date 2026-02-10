import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
  Min,
  IsInt
} from 'class-validator';

class CreditFeeDto {
  @IsInt()
  @Min(1)
  installments: number;

  @IsNumber()
  @Min(0)
  feePercent: number;
}

export class UpdateTenantProfileDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  pixKey?: string;

  @ValidateNested({ each: true })
  @Type(() => CreditFeeDto)
  @IsArray()
  @IsOptional()
  creditFees?: CreditFeeDto[];

  @IsNumber()
  @Min(0)
  @IsOptional()
  debitFeePercent?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  chequeFeePercent?: number;
}

