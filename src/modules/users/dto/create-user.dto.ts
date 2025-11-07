import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min
} from 'class-validator';
import { UserRole } from '../user.schema';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsEnum(['admin', 'manager', 'tech', 'viewer'])
  role: UserRole;

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
