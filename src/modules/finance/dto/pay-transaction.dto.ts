import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class PayTransactionDto {
  @IsEnum(['PIX', 'CASH', 'CARD'])
  method: 'PIX' | 'CASH' | 'CARD';

  @IsNumber()
  amount: number;

  @IsString()
  @IsOptional()
  txid?: string;

  @IsNumber()
  @IsOptional()
  installmentNumber?: number;
}
