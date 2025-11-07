import { Body, Controller, Get, Headers, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { Public } from '../../common/decorators/public.decorator';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { withAudit } from '../../common/utils/audit.util';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @Public()
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Headers('user-agent') ua?: string,
    @Headers('x-forwarded-for') ip?: string
  ) {
    return this.authService.login(undefined, dto, ip, ua);
  }

  @Post('refresh')
  @Public()
  async refresh(
    @Body() dto: RefreshDto,
    @Headers('user-agent') ua?: string,
    @Headers('x-forwarded-for') ip?: string
  ) {
    return this.authService.refresh(dto, ip, ua);
  }

  @Post('logout')
  async logout(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body('jti') jti: string
  ) {
    return withAudit(await this.authService.logout(tenantId, user.id, jti), {
      tenantId,
      entity: 'sessions',
      entityId: jti,
      action: 'delete',
      before: { jti },
      by: user.id
    });
  }

  @Get('me')
  async me(@CurrentUser() user: any) {
    return user;
  }
}
