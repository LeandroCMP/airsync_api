import { Body, Controller, Get, Headers, HttpCode, Post, Patch } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { Public } from '../../common/decorators/public.decorator';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { withAudit } from '../../common/utils/audit.util';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { TenantService } from '../tenancy/tenant.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tenantService: TenantService
  ) {}

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
    const tenant = user?.tenantId ? await this.tenantService.findById(user.tenantId) : null;
    const billingStatus = (tenant as any)?.billingStatus;
    return { ...user, billingStatus, accountSuspended: billingStatus === 'suspended' };
  }

  @Patch('me')
  async updateProfile(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateProfileDto
  ) {
    const result = await this.authService.updateProfile(tenantId, user.id, dto);
    return withAudit(result.after, {
      tenantId,
      entity: 'users',
      entityId: user.id,
      action: 'update',
      before: result.before,
      after: result.after,
      by: user.id
    });
  }

  @Post('change-password')
  async changePassword(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: ChangePasswordDto
  ) {
    await this.authService.changePassword(tenantId, user.id, dto);
    return { success: true };
  }

  @Post('forgot-password')
  @Public()
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @Public()
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
