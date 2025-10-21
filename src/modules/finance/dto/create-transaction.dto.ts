import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested
} from 'class-validator';

class InstallmentDto {
  @IsNumber()
  number: number;

  @IsDateString()
  dueDate: Date;

  @IsNumber()
  amount: number;
}

export class CreateFinanceTransactionDto {
  @IsEnum(['receivable', 'payable'])
  type: 'receivable' | 'payable';

  @IsString()
  @IsNotEmpty()
  ref: string;

  @IsString()
  @IsOptional()
  partyId?: string;

  @IsString()
  @IsNotEmpty()
  category: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  dueDate: Date;

  @IsNumber()
  amount: number;

  @ValidateNested({ each: true })
  @Type(() => InstallmentDto)
  @IsArray()
  @IsOptional()
  installments?: InstallmentDto[];
}
