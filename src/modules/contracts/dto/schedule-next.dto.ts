import { IsDateString, IsNotEmpty, IsString } from 'class-validator';

export class ScheduleNextDto {
  @IsDateString({}, { message: 'Informe a data e hora da visita.' })
  visitAt: Date;

  @IsString()
  @IsNotEmpty({ message: 'Informe o local da visita.' })
  locationId: string;
}
