import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength
} from 'class-validator';

export class SignupDto {
  @IsString()
  @IsNotEmpty()
  companyName: string;

  @IsString()
  @IsNotEmpty()
  ownerName: string;

  @IsEmail()
  ownerEmail: string;

  @IsString()
  @IsNotEmpty()
  ownerPhone: string;

  @IsString()
  @IsNotEmpty()
  document: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @IsInt()
  @Min(1)
  @Max(28)
  @IsOptional()
  billingDay?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
