import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationService } from './notification.service';
import { EmailService } from './email.service';
import { WhatsappService } from './whatsapp.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Tenant, TenantSchema } from '../tenancy/tenant.schema';
import { WhatsappController } from './whatsapp.controller';
import { TenancyModule } from '../tenancy/tenancy.module';

@Module({
  imports: [ConfigModule, MongooseModule.forFeature([{ name: Tenant.name, schema: TenantSchema }]), TenancyModule],
  providers: [NotificationService, EmailService, WhatsappService],
  controllers: [WhatsappController],
  exports: [NotificationService, EmailService, WhatsappService]
})
export class NotificationsModule {}
