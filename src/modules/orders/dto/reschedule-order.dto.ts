import { IsDateString, IsOptional, IsString } from 'class-validator';

export class RescheduleOrderDto {
  @IsDateString()
  scheduledAt: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

