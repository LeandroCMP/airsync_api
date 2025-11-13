import { IsDateString, IsNumber, IsOptional, IsString } from 'class-validator';

export class NegotiateInvoiceDto {
  @IsNumber()
  amount: number;

  @IsDateString()
  dueDate: Date;

  @IsString()
  @IsOptional()
  notes?: string;
}

