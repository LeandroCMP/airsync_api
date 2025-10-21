import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class SubmitNpsDto {
  @IsString()
  @IsNotEmpty()
  tenantId: string;

  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsString()
  @IsNotEmpty()
  clientId: string;

  @IsNumber()
  score: number;

  @IsString()
  @IsOptional()
  comment?: string;
}
