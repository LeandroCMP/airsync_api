import { IsOptional, IsString } from 'class-validator';

export class UpdateWhatsappDto {
  @IsString()
  @IsOptional()
  phoneId?: string;

  @IsString()
  @IsOptional()
  token?: string;

  @IsString()
  @IsOptional()
  wabaId?: string;
}
