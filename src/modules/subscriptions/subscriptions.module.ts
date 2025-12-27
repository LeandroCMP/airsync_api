import { Module } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Subscription, SubscriptionSchema } from './subscription.schema';
import { SubscriptionInvoice, SubscriptionInvoiceSchema } from './subscription-invoice.schema';
import { Tenant, TenantSchema } from '../../core/tenancy/tenant.schema';
import { SubscriptionScheduler } from './subscription.scheduler';
import { NotificationsModule } from '../../core/notifications/notifications.module';
import { StripeService } from './stripe.service';
import { FinanceModule } from '../finance/finance.module';
import {
  SubscriptionPaymentLog,
  SubscriptionPaymentLogSchema
} from './subscription-payment-log.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: SubscriptionInvoice.name, schema: SubscriptionInvoiceSchema },
      { name: SubscriptionPaymentLog.name, schema: SubscriptionPaymentLogSchema },
      { name: Tenant.name, schema: TenantSchema }
    ]),
    NotificationsModule,
    FinanceModule
  ],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, SubscriptionScheduler, StripeService],
  exports: [SubscriptionsService, StripeService]
})
export class SubscriptionsModule {}
