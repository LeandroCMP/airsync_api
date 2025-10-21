import { IsDateString, IsOptional } from 'class-validator';

export class ReceivePurchaseDto {
  @IsOptional()
  @IsDateString()
  receivedAt?: Date;
}
