import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateTimelineDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe o cliente.' })
  clientId: string;

  @IsEnum(['call', 'whatsapp', 'email', 'note', 'nps'], { message: 'Tipo invalido.' })
  type: 'call' | 'whatsapp' | 'email' | 'note' | 'nps';

  @IsDateString({}, { message: 'Informe uma data valida (ISO).' })
  @IsOptional()
  at?: Date;

  @IsString()
  @IsOptional()
  by?: string;

  @IsString()
  @IsNotEmpty({ message: 'Descreva a interacao.' })
  text: string;
}
