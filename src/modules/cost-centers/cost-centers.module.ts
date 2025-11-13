import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CostCenter, CostCenterSchema } from './cost-center.schema';
import { CostCentersController } from './cost-centers.controller';
import { CostCentersService } from './cost-centers.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: CostCenter.name, schema: CostCenterSchema }])],
  controllers: [CostCentersController],
  providers: [CostCentersService],
  exports: [CostCentersService]
})
export class CostCentersModule {}

