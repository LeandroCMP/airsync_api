import { Injectable, UnauthorizedException, ConflictException, ForbiddenException } from '@nestjs/common';
import { UsersService } from '../../modules/users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { InjectModel } from '@nestjs/mongoose';
import { Session, SessionDocument } from './session.schema';
import { Model } from 'mongoose';
import { randomUUID } from 'crypto';
import { TenantService } from '../tenancy/tenant.service';
import { AuthLogService } from './auth-log.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly tenantService: TenantService,
    private readonly authLog: AuthLogService,
    @InjectModel(Session.name) private readonly sessionModel: Model<SessionDocument>
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
        role: 'admin',
        permissions: ['*']
      } as any,
      'system'
    );

    const session = await this.sessionModel.create({
      tenantId: tenant._id.toString(),
      userId: admin._id.toString(),
      jti: randomUUID(),
      expiresAt: new Date(Date.now() + this.parseExpires(this.configService.get<string>('jwt.refreshExpiresIn')))
    });

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
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
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
        message: 'User account is disabled. Contact your administrator to regain access.'
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
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
    }
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
    return { user: this.usersService.sanitize(userDoc), ...tokens };
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
        throw new UnauthorizedException({ code: 'INVALID_REFRESH', message: 'User not found' });
      }
      const payload = {
        sub: decoded.sub,
        tenantId: decoded.tenantId,
        role: user.role,
        permissions: user.permissions
      };
      return this.generateTokens(payload, newSession);
    } catch (err) {
      throw new UnauthorizedException({ code: 'INVALID_REFRESH', message: 'Refresh token invalid' });
    }
  }

  async logout(tenantId: string, userId: string, jti: string) {
    await this.sessionModel.updateOne({ tenantId, userId, jti }, { revoked: true });
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

