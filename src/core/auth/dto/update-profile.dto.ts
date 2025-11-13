import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  @MaxLength(120)
  name?: string;

  @IsEmail()
  @IsOptional()
  email?: string;
}

