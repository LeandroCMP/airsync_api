import { IsMongoId, IsNotEmpty, IsString, Matches } from 'class-validator';

export class VerifySignupDto {
  @IsMongoId()
  @IsNotEmpty()
  tenantId: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, { message: 'code must be a 6-digit number' })
  code: string;
}
