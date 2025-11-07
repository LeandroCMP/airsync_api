import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min
} from 'class-validator';
import { UserRole } from '../user.schema';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(['admin', 'manager', 'tech', 'viewer'])
  @IsOptional()
  role?: UserRole;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  permissions?: string[];

  @IsNumber()
  @IsOptional()
  hourlyCost?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  salary?: number;

  @IsInt()
  @Min(1)
  @Max(31)
  @IsOptional()
  paymentDay?: number;

  @IsEnum(['monthly', 'biweekly', 'weekly'])
  @IsOptional()
  paymentFrequency?: 'monthly' | 'biweekly' | 'weekly';

  @IsEnum(['PIX', 'CASH', 'CARD', 'BANK_TRANSFER'])
  @IsOptional()
  paymentMethod?: 'PIX' | 'CASH' | 'CARD' | 'BANK_TRANSFER';

  @IsString()
  @IsOptional()
  compensationNotes?: string;

  @IsBoolean()
  @IsOptional()
  active?: boolean;
}
