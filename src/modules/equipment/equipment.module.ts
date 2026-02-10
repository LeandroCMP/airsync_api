import { Module } from '@nestjs/common';
import { EquipmentService } from './equipment.service';
import { EquipmentController } from './equipment.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Equipment, EquipmentSchema } from './equipment.schema';
import { EquipmentHistoryModule } from '../equipment-history/equipment-history.module';
import { OrdersModule } from '../orders/orders.module';
import { PdfModule } from '../../pdf/pdf.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Equipment.name, schema: EquipmentSchema }]),
    EquipmentHistoryModule,
    OrdersModule,
    PdfModule
  ],
  controllers: [EquipmentController],
  providers: [EquipmentService],
  exports: [EquipmentService]
})
export class EquipmentModule {}
