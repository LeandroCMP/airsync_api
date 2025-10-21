import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FleetVehicle, FleetVehicleDocument } from './fleet-vehicle.schema';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { VehicleCheckDto } from './dto/vehicle-check.dto';
import { VehicleFuelDto } from './dto/vehicle-fuel.dto';
import { VehicleMaintenanceDto } from './dto/vehicle-maintenance.dto';

@Injectable()
export class FleetService {
  constructor(@InjectModel(FleetVehicle.name) private readonly fleetModel: Model<FleetVehicleDocument>) {}

  async create(tenantId: string, dto: CreateVehicleDto, userId: string) {
    const vehicle = await this.fleetModel.create({
      tenantId,
      plate: dto.plate,
      model: dto.model,
      year: dto.year,
      teamId: dto.teamId,
      odometer: dto.odometer || 0,
      costCenter: dto.costCenter
    });
    return vehicle.toObject();
  }

  async list(tenantId: string) {
    return this.fleetModel.find({ tenantId }).lean();
  }

  async findById(tenantId: string, id: string) {
    const vehicle = await this.fleetModel.findOne({ tenantId, _id: id });
    if (!vehicle) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Vehicle not found' });
    }
    return vehicle;
  }

  async addCheck(tenantId: string, id: string, dto: VehicleCheckDto) {
    const vehicle = await this.findById(tenantId, id);
    vehicle.checks.push({ ...dto, photos: [] } as any);
    vehicle.odometer = Math.max(vehicle.odometer, dto.km);
    await vehicle.save();
    return vehicle.toObject();
  }

  async addFuel(tenantId: string, id: string, dto: VehicleFuelDto) {
    const vehicle = await this.findById(tenantId, id);
    vehicle.fuelLogs.push(dto as any);
    vehicle.odometer = Math.max(vehicle.odometer, dto.km);
    await vehicle.save();
    return vehicle.toObject();
  }

  async addMaintenance(tenantId: string, id: string, dto: VehicleMaintenanceDto) {
    const vehicle = await this.findById(tenantId, id);
    vehicle.maintenances.push(dto as any);
    vehicle.odometer = Math.max(vehicle.odometer, dto.atKm);
    await vehicle.save();
    return vehicle.toObject();
  }
}
