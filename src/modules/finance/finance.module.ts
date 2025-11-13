import { Module } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { FinanceController } from './finance.controller';
import { FinanceDashboardController } from './finance-dashboard.controller';
import { FinanceInsightsController } from './finance-insights.controller';
import { FinanceInsightsService } from './finance-insights.service';
import { MongooseModule } from '@nestjs/mongoose';
import { FinanceTransaction, FinanceTransactionSchema } from './finance-transaction.schema';
import { Order, OrderSchema } from '../orders/order.schema';
import { Purchase, PurchaseSchema } from '../purchases/purchase.schema';
import { OpenAiModule } from '../../core/openai/openai.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FinanceTransaction.name, schema: FinanceTransactionSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Purchase.name, schema: PurchaseSchema }
    ]),
    OpenAiModule
  ],
  controllers: [FinanceController, FinanceDashboardController, FinanceInsightsController],
  providers: [FinanceService, FinanceInsightsService],
  exports: [FinanceService]
})
export class FinanceModule {}
