import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EquipmentHistory, EquipmentHistorySchema } from './equipment-history.schema';
import { EquipmentHistoryService } from './equipment-history.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: EquipmentHistory.name, schema: EquipmentHistorySchema }])],
  providers: [EquipmentHistoryService],
  exports: [EquipmentHistoryService]
})
export class EquipmentHistoryModule {}

