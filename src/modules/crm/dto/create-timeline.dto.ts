import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateTimelineDto {
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @IsEnum(['call', 'whatsapp', 'email', 'note', 'nps'])
  type: 'call' | 'whatsapp' | 'email' | 'note' | 'nps';

  @IsDateString()
  @IsOptional()
  at?: Date;

  @IsString()
  @IsOptional()
  by?: string;

  @IsString()
  @IsNotEmpty()
  text: string;
}
