import { Module } from '@nestjs/common';
import { FleetService } from './fleet.service';
import { FleetController } from './fleet.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { FleetVehicle, FleetVehicleSchema } from './fleet-vehicle.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: FleetVehicle.name, schema: FleetVehicleSchema }])],
  controllers: [FleetController],
  providers: [FleetService],
  exports: [FleetService]
})
export class FleetModule {}
