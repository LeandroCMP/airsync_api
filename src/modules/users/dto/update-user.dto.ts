import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString
} from 'class-validator';
import { UserRole } from '../user.schema';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(['admin', 'manager', 'tech', 'viewer'])
  @IsOptional()
  role?: UserRole;

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
