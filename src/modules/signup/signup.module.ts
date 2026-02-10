import { Module } from '@nestjs/common';
import { SignupService } from './signup.service';
import { SignupController } from './signup.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Tenant, TenantSchema } from '../../core/tenancy/tenant.schema';
import { UsersModule } from '../users/users.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { AuditModule } from '../../core/audit/audit.module';
import { ActivationCode, ActivationCodeSchema } from './activation-code.schema';
import { NotificationsModule } from '../../core/notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Tenant.name, schema: TenantSchema },
      { name: ActivationCode.name, schema: ActivationCodeSchema }
    ]),
    UsersModule,
    SubscriptionsModule,
    AuditModule,
    NotificationsModule
  ],
  controllers: [SignupController],
  providers: [SignupService]
})
export class SignupModule {}
