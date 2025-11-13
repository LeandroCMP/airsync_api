import { Module } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Subscription, SubscriptionSchema } from './subscription.schema';
import { SubscriptionInvoice, SubscriptionInvoiceSchema } from './subscription-invoice.schema';
import { Tenant, TenantSchema } from '../../core/tenancy/tenant.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: SubscriptionInvoice.name, schema: SubscriptionInvoiceSchema },
      { name: Tenant.name, schema: TenantSchema }
    ])
  ],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService]
})
export class SubscriptionsModule {}

