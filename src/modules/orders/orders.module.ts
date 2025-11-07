import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema } from './order.schema';
import { InventoryModule } from '../inventory/inventory.module';
import { FinanceModule } from '../finance/finance.module';
import { PdfModule } from '../../pdf/pdf.module';
import { FilesModule } from '../../core/files/files.module';
import { EquipmentHistoryModule } from '../equipment-history/equipment-history.module';
import { TenancyModule } from '../../core/tenancy/tenancy.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }]),
    InventoryModule,
    FinanceModule,
    PdfModule,
    FilesModule,
    EquipmentHistoryModule,
    TenancyModule
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService]
})
export class OrdersModule {}
