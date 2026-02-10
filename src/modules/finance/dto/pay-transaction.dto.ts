import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class PayTransactionDto {
  @IsEnum(['PIX', 'CASH', 'CARD', 'CARD_CREDIT', 'CARD_DEBIT', 'BANK_TRANSFER', 'CHEQUE'])
  method: 'PIX' | 'CASH' | 'CARD' | 'CARD_CREDIT' | 'CARD_DEBIT' | 'BANK_TRANSFER' | 'CHEQUE';

  @IsNumber()
  @IsOptional()
  amount?: number;

  @IsString()
  @IsOptional()
  txid?: string;

  @IsString()
  @IsOptional()
  idempotencyKey?: string;

  @IsNumber()
  @IsOptional()
  installmentNumber?: number;
}
