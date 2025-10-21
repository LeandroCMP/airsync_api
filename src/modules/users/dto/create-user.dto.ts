import { IsArray, IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { UserRole } from '../user.schema';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsEnum(['admin', 'manager', 'tech', 'viewer'])
  role: UserRole;

  @IsArray()
  @IsOptional()
  permissions?: string[];

  @IsNumber()
  @IsOptional()
  hourlyCost?: number;

  @IsBoolean()
  @IsOptional()
  active?: boolean;
}
