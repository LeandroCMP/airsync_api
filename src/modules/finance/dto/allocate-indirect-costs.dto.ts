import { IsArray, IsDateString, IsOptional, IsString } from 'class-validator';

export class AllocateIndirectCostsDto {
  @IsDateString()
  from: string;

  @IsDateString()
  to: string;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  categories?: string[];
}

