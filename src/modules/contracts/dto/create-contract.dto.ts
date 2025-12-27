import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

class PlanDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome do plano.' })
  name: string;

  @Type(() => Number)
  intervalMonths: number;

  @Type(() => Number)
  slaHours: number;
}

export class CreateContractDto {
  @IsString()
  @IsNotEmpty({ message: 'Selecione o cliente.' })
  clientId: string;

  @IsArray()
  @IsOptional()
  equipmentIds?: string[];

  @ValidateNested()
  @Type(() => PlanDto)
  plan: PlanDto;

  @IsNumber({}, { message: 'Informe o valor mensal do contrato.' })
  priceMonthly: number;

  @IsEnum(['active', 'paused', 'ended'], {
    message: 'Status invalido. Use active, paused ou ended.'
  })
  status: 'active' | 'paused' | 'ended';

  @IsArray()
  @IsOptional()
  nextVisits?: Date[];

  @IsString()
  @IsOptional()
  notes?: string;
}
