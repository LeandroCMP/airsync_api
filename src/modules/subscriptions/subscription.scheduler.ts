import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SubscriptionsService } from './subscriptions.service';
import { InjectModel } from '@nestjs/mongoose';
import { Subscription, SubscriptionDocument } from './subscription.schema';
import { Model } from 'mongoose';

@Injectable()
export class SubscriptionScheduler {
  private readonly logger = new Logger(SubscriptionScheduler.name);

  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    @InjectModel(Subscription.name) private readonly subscriptionModel: Model<SubscriptionDocument>
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleRecurringBilling() {
    const subscriptions = await this.subscriptionModel.find().select(['tenantId']).lean();
    for (const sub of subscriptions) {
      try {
        await this.subscriptionsService.runBillingCycle(sub.tenantId);
      } catch (err) {
        this.logger.error(
          `Failed to run billing cycle for tenant ${sub.tenantId}`,
          err instanceof Error ? err.stack : undefined
        );
      }
    }
  }
}

