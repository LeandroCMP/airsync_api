import { IsBoolean, IsOptional } from 'class-validator';

export class CreateCarnetDto {
  @IsBoolean()
  @IsOptional()
  payUpfront?: boolean;
}
