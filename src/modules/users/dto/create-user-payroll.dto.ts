import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min
} from 'class-validator';
import { PayrollPaymentMethod, PayrollStatus } from '../user-payroll.schema';

export class CreateUserPayrollDto {
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'reference must be in YYYY-MM format'
  })
  reference: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @IsEnum(['pending', 'paid'])
  @IsOptional()
  status?: PayrollStatus;

  @IsDateString()
  @IsOptional()
  paidAt?: string;

  @IsEnum(['PIX', 'CASH', 'CARD', 'BANK_TRANSFER'])
  @IsOptional()
  paymentMethod?: PayrollPaymentMethod;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  attachmentBase64?: string;

  @IsString()
  @IsOptional()
  attachmentFilename?: string;
}

