import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class PayTransactionDto {
  @IsEnum(['PIX', 'CASH', 'CARD', 'CARD_CREDIT', 'CARD_DEBIT', 'BANK_TRANSFER', 'CHEQUE'])
  method: 'PIX' | 'CASH' | 'CARD' | 'CARD_CREDIT' | 'CARD_DEBIT' | 'BANK_TRANSFER' | 'CHEQUE';

  @IsNumber()
  amount: number;

  @IsString()
  @IsOptional()
  txid?: string;

  @IsNumber()
  @IsOptional()
  installmentNumber?: number;
}
