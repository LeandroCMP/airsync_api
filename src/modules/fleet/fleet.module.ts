import { Module } from '@nestjs/common';
import { FleetService } from './fleet.service';
import { FleetController } from './fleet.controller';
import { FleetInsightsController } from './fleet-insights.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { FleetVehicle, FleetVehicleSchema } from './fleet-vehicle.schema';
import { FinanceModule } from '../finance/finance.module';
import { OpenAiModule } from '../../core/openai/openai.module';
import { FleetInsightsService } from './fleet-insights.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: FleetVehicle.name, schema: FleetVehicleSchema }]),
    FinanceModule,
    OpenAiModule
  ],
  controllers: [FleetController, FleetInsightsController],
  providers: [FleetService, FleetInsightsService],
  exports: [FleetService]
})
export class FleetModule {}
