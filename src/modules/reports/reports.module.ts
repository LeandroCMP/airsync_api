import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { FinanceTransaction, FinanceTransactionSchema } from '../finance/finance-transaction.schema';
import { Order, OrderSchema } from '../orders/order.schema';
import { FleetVehicle, FleetVehicleSchema } from '../fleet/fleet-vehicle.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FinanceTransaction.name, schema: FinanceTransactionSchema },
      { name: Order.name, schema: OrderSchema },
      { name: FleetVehicle.name, schema: FleetVehicleSchema }
    ])
  ],
  controllers: [ReportsController],
  providers: [ReportsService]
})
export class ReportsModule {}
