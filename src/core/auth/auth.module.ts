import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../../modules/users/users.module';
import { MongooseModule } from '@nestjs/mongoose';
import { Session, SessionSchema } from './session.schema';
import { AuthLoginLog, AuthLoginLogSchema } from './auth-login-log.schema';
import { AuthLogService } from './auth-log.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TenancyModule } from '../tenancy/tenancy.module';
import { PasswordResetToken, PasswordResetTokenSchema } from './password-reset-token.schema';
import { SubscriptionsModule } from '../../modules/subscriptions/subscriptions.module';

@Module({
  imports: [
    JwtModule.register({}),
    UsersModule,
    TenancyModule,
    MongooseModule.forFeature([
      { name: Session.name, schema: SessionSchema },
      { name: AuthLoginLog.name, schema: AuthLoginLogSchema },
      { name: PasswordResetToken.name, schema: PasswordResetTokenSchema }
    ]),
    SubscriptionsModule
  ],
  providers: [AuthService, JwtStrategy, AuthLogService],
  controllers: [AuthController],
  exports: [AuthService]
})
export class AuthModule {}
