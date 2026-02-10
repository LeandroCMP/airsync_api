import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  NotFoundException
} from '@nestjs/common';
import { UsersService } from '../../modules/users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { InjectModel } from '@nestjs/mongoose';
import { Session, SessionDocument } from './session.schema';
import { Model } from 'mongoose';
import { randomUUID, createHash } from 'crypto';
import { TenantService } from '../tenancy/tenant.service';
import { AuthLogService } from './auth-log.service';
import { PasswordResetToken, PasswordResetTokenDocument } from './password-reset-token.schema';
import { SubscriptionsService } from '../../modules/subscriptions/subscriptions.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly tenantService: TenantService,
    private readonly authLog: AuthLogService,
    private readonly subscriptionsService: SubscriptionsService,
    @InjectModel(Session.name) private readonly sessionModel: Model<SessionDocument>,
    @InjectModel(PasswordResetToken.name)
    private readonly resetTokenModel: Model<PasswordResetTokenDocument>
  ) {}

  private async generateTokens(payload: any, session: SessionDocument) {
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('jwt.accessSecret'),
      expiresIn: this.configService.get<string>('jwt.accessExpiresIn')
    });
    const refreshToken = await this.jwtService.signAsync(
      { sub: payload.sub, tenantId: payload.tenantId, jti: session.jti },
      {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: this.configService.get<string>('jwt.refreshExpiresIn')
      }
    );
    return { accessToken, refreshToken, jti: session.jti };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  async register(dto: RegisterDto) {
    // Ensure email is unique globally before creating tenant to avoid orphan tenants
    const existing = await this.usersService.findByEmailAnyTenant(dto.email);
    if (existing) {
      throw new ConflictException({ code: 'EMAIL_TAKEN', message: 'Email já está em uso' });
    }
    const tenant = await this.tenantService.create(dto.tenantName);
    const admin = await this.usersService.create(
      tenant._id.toString(),
      {
        name: dto.name,
        email: dto.email,
        password: dto.password,
        role: 'owner'
      } as any,
      'system'
    );

    const session = await this.sessionModel.create({
      tenantId: tenant._id.toString(),
      userId: admin._id.toString(),
      jti: randomUUID(),
      expiresAt: new Date(Date.now() + this.parseExpires(this.configService.get<string>('jwt.refreshExpiresIn')))
    });
    await this.subscriptionsService.ensureSubscription(tenant._id.toString());

    const payload = {
      sub: admin._id.toString(),
      tenantId: tenant._id.toString(),
      role: admin.role,
      permissions: admin.permissions
    };
    const tokens = await this.generateTokens(payload, session);
    return { tenantId: tenant._id.toString(), user: admin, ...tokens };
  }

  async login(tenantId: string | undefined, dto: LoginDto, ip?: string, ua?: string) {
    let userDoc: any;
    if (tenantId) {
      userDoc = await this.usersService.findByEmail(tenantId, dto.email);
    } else {
      userDoc = await this.usersService.findByEmailAnyTenant(dto.email);
      tenantId = userDoc?.tenantId;
    }
    if (!userDoc) {
      await this.authLog.logLoginAttempt({
        email: dto.email,
        tenantId,
        success: false,
        message: 'USER_NOT_FOUND',
        ip,
        ua
      });
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha incorretos.' });
    }
    if (userDoc.active === false) {
      await this.authLog.logLoginAttempt({
        email: dto.email,
        tenantId,
        userId: userDoc._id.toString(),
        success: false,
        message: 'USER_INACTIVE - account disabled',
        ip,
        ua
      });
      throw new ForbiddenException({
        code: 'USER_INACTIVE',
        message: 'Conta desativada. Fale com o administrador para reativar.'
      });
    }
    const isValid = await bcrypt.compare(dto.password, userDoc.passwordHash);
    if (!isValid) {
      await this.authLog.logLoginAttempt({
        email: dto.email,
        tenantId,
        userId: userDoc._id.toString(),
        success: false,
        message: 'INVALID_PASSWORD',
        ip,
        ua
      });
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha incorretos.' });
    }
    const tenant = await this.subscriptionsService.assertTenantCanLogin(tenantId, userDoc.role, {
      allowOwnerSuspended: true
    });
    const session = await this.sessionModel.create({
      tenantId,
      userId: userDoc._id.toString(),
      jti: randomUUID(),
      expiresAt: new Date(Date.now() + this.parseExpires(this.configService.get<string>('jwt.refreshExpiresIn'))),
      ip,
      ua
    });
    const payload = {
      sub: userDoc._id.toString(),
      tenantId,
      role: userDoc.role,
      permissions: userDoc.permissions
    };
    const tokens = await this.generateTokens(payload, session);
    await this.authLog.logLoginAttempt({
      email: dto.email,
      tenantId,
      userId: userDoc._id.toString(),
      success: true,
      message: 'LOGIN_SUCCESS',
      ip,
      ua
    });
    const billingStatus = tenant?.billingStatus;
    return {
      user: { ...this.usersService.sanitize(userDoc), billingStatus, accountSuspended: billingStatus === 'suspended' },
      ...tokens
    };
  }

  async refresh(dto: RefreshDto, ip?: string, ua?: string) {
    try {
      const decoded = await this.jwtService.verifyAsync(dto.refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret')
      });
      const session = await this.sessionModel.findOne({
        tenantId: decoded.tenantId,
        userId: decoded.sub,
        jti: decoded.jti
      });
      if (!session || session.revoked || session.expiresAt < new Date()) {
        throw new Error('invalid session');
      }
      session.revoked = true;
      await session.save();

      const newSession = await this.sessionModel.create({
        tenantId: decoded.tenantId,
        userId: decoded.sub,
        jti: randomUUID(),
        expiresAt: new Date(Date.now() + this.parseExpires(this.configService.get<string>('jwt.refreshExpiresIn'))),
        ip,
        ua
      });

      const user = await this.usersService.findById(decoded.tenantId, decoded.sub);
      if (!user) {
        throw new UnauthorizedException({ code: 'INVALID_REFRESH', message: 'Sessão inválida. Entre novamente.' });
      }
      const tenant = await this.subscriptionsService.assertTenantCanLogin(decoded.tenantId, user.role, {
        allowOwnerSuspended: true
      });
      const payload = {
        sub: decoded.sub,
        tenantId: decoded.tenantId,
        role: user.role,
        permissions: user.permissions
      };
      const tokens = await this.generateTokens(payload, newSession);
      const billingStatus = tenant?.billingStatus;
      return { ...tokens, billingStatus, accountSuspended: billingStatus === 'suspended' };
    } catch (err) {
      throw new UnauthorizedException({ code: 'INVALID_REFRESH', message: 'Sessão inválida. Faça login novamente.' });
    }
  }

  async logout(tenantId: string, userId: string, jti: string) {
    await this.sessionModel.updateOne({ tenantId, userId, jti }, { revoked: true });
    return { success: true };
  }

  async updateProfile(tenantId: string, userId: string, dto: UpdateProfileDto) {
    const beforeDoc = await this.usersService.findById(tenantId, userId);
    if (!beforeDoc) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'User not found' });
    }
    const before = this.usersService.sanitize(beforeDoc);
    const after = await this.usersService.updateSelf(tenantId, userId, dto);
    return { before, after };
  }

  async changePassword(tenantId: string, userId: string, dto: ChangePasswordDto) {
    await this.usersService.changePassword(tenantId, userId, dto.currentPassword, dto.newPassword);
    await this.sessionModel.updateMany({ tenantId, userId }, { revoked: true });
    return { success: true };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.usersService.findByEmailAnyTenant(dto.email);
    if (!user) {
      return { success: true };
    }
    await this.resetTokenModel.updateMany(
      { userId: user._id.toString(), used: false },
      { used: true, usedAt: new Date() }
    );
    const token = randomUUID().replace(/-/g, '');
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 min
    await this.resetTokenModel.create({
      tenantId: user.tenantId,
      userId: user._id.toString(),
      email: user.email,
      tokenHash,
      expiresAt
    });
    const response: Record<string, any> = { success: true };
    if ((this.configService.get<string>('app.env') || 'development') !== 'production') {
      response.resetToken = token;
    }
    return response;
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = this.hashToken(dto.token);
    const record = await this.resetTokenModel.findOne({ tokenHash });
    if (!record || record.used) {
      throw new BadRequestException({
        code: 'INVALID_TOKEN',
        message: 'Token inválido'
      });
    }
    if (record.expiresAt < new Date()) {
      throw new BadRequestException({ code: 'TOKEN_EXPIRED', message: 'Token expirado' });
    }
    await this.usersService.forcePasswordChange(record.tenantId, record.userId, dto.newPassword, 'system');
    record.used = true;
    record.usedAt = new Date();
    await record.save();
    await this.sessionModel.updateMany({ tenantId: record.tenantId, userId: record.userId }, { revoked: true });
    return { success: true };
  }

  parseExpires(value: string) {
    if (value.endsWith('d')) {
      return parseInt(value) * 24 * 60 * 60 * 1000;
    }
    if (value.endsWith('s')) {
      return parseInt(value) * 1000;
    }
    if (value.endsWith('m')) {
      return parseInt(value) * 60 * 1000;
    }
    if (value.endsWith('h')) {
      return parseInt(value) * 60 * 60 * 1000;
    }
    return parseInt(value) * 1000;
  }
}

