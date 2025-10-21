import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../../modules/users/users.module';
import { MongooseModule } from '@nestjs/mongoose';
import { Session, SessionSchema } from './session.schema';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TenancyModule } from '../tenancy/tenancy.module';

@Module({
  imports: [
    JwtModule.register({}),
    UsersModule,
    TenancyModule,
    MongooseModule.forFeature([{ name: Session.name, schema: SessionSchema }])
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService]
})
export class AuthModule {}
