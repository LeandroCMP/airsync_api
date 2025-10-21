import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

class PlanDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @Type(() => Number)
  intervalMonths: number;

  @Type(() => Number)
  slaHours: number;
}

export class CreateContractDto {
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @IsArray()
  @IsOptional()
  equipmentIds?: string[];

  @ValidateNested()
  @Type(() => PlanDto)
  plan: PlanDto;

  @IsNumber()
  priceMonthly: number;

  @IsEnum(['active', 'paused', 'ended'])
  status: 'active' | 'paused' | 'ended';

  @IsArray()
  @IsOptional()
  nextVisits?: Date[];

  @IsString()
  @IsOptional()
  notes?: string;
}
