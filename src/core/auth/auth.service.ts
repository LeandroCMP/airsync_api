import { Injectable, UnauthorizedException } from '@nestjs/common';
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

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly tenantService: TenantService,
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

  async login(tenantId: string, dto: LoginDto, ip?: string, ua?: string) {
    const userDoc = await this.usersService.findByEmail(tenantId, dto.email);
    if (!userDoc) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
    }
    const isValid = await bcrypt.compare(dto.password, userDoc.passwordHash);
    if (!isValid) {
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
