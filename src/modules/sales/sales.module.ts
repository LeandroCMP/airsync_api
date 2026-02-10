import { Module } from '@nestjs/common';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { SalesInsightsController } from './sales-insights.controller';
import { SalesInsightsService } from './sales-insights.service';
import { MongooseModule } from '@nestjs/mongoose';
import { SaleOrder, SaleOrderSchema } from './sales-order.schema';
import { InventoryModule } from '../inventory/inventory.module';
import { OrdersModule } from '../orders/orders.module';
import { FinanceModule } from '../finance/finance.module';
import { EquipmentModule } from '../equipment/equipment.module';
import { OpenAiModule } from '../../core/openai/openai.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: SaleOrder.name, schema: SaleOrderSchema }]),
    InventoryModule,
    OrdersModule,
    FinanceModule,
    EquipmentModule,
    OpenAiModule
  ],
  controllers: [SalesController, SalesInsightsController],
  providers: [SalesService, SalesInsightsService],
  exports: [SalesService]
})
export class SalesModule {}
