import { Body, Controller, Post } from '@nestjs/common';
import { SignupService } from './signup.service';
import { SignupDto } from './dto/signup.dto';
import { Public } from '../../common/decorators/public.decorator';
import { VerifySignupDto } from './dto/verify-signup.dto';

@Controller('signups')
export class SignupController {
  constructor(private readonly signupService: SignupService) {}

  @Post()
  @Public()
  async create(@Body() dto: SignupDto) {
    const result = await this.signupService.register(dto);
    return {
      tenantId: result.tenantId,
      tenantName: result.tenantName,
      owner: result.owner,
      stripeCustomerId: result.stripeCustomerId,
      activationExpiresAt: result.activationExpiresAt,
      activationCode: result.activationCode
    };
  }

  @Post('verify')
  @Public()
  async verify(@Body() dto: VerifySignupDto) {
    const result = await this.signupService.verify(dto);
    return {
      tenantId: result.tenantId,
      activated: true
    };
  }
}
