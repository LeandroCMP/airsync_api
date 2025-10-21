import { IsDateString, IsNotEmpty, IsString } from 'class-validator';

export class ScheduleNextDto {
  @IsDateString()
  visitAt: Date;

  @IsString()
  @IsNotEmpty()
  locationId: string;
}
