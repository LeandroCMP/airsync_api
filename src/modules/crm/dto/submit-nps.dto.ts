import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class SubmitNpsDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe o tenant.' })
  tenantId: string;

  @IsString()
  @IsNotEmpty({ message: 'Informe a ordem/OS relacionada.' })
  orderId: string;

  @IsString()
  @IsNotEmpty({ message: 'Informe o cliente.' })
  clientId: string;

  @IsNumber({}, { message: 'Informe a nota de 0 a 10.' })
  score: number;

  @IsString()
  @IsOptional()
  comment?: string;
}
