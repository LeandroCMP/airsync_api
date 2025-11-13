import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FleetVehicle, FleetVehicleDocument } from './fleet-vehicle.schema';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { VehicleCheckDto } from './dto/vehicle-check.dto';
import { VehicleFuelDto } from './dto/vehicle-fuel.dto';
import { VehicleMaintenanceDto } from './dto/vehicle-maintenance.dto';
import { FinanceService } from '../finance/finance.service';

@Injectable()
export class FleetService {
  constructor(
    @InjectModel(FleetVehicle.name) private readonly fleetModel: Model<FleetVehicleDocument>,
    private readonly financeService: FinanceService
  ) {}

  async create(tenantId: string, dto: CreateVehicleDto, userId: string) {
    try {
      const vehicle = await this.fleetModel.create({
        tenantId,
        plate: dto.plate,
        model: dto.model,
        year: dto.year,
        teamId: dto.teamId,
        odometer: dto.odometer || 0,
        costCenter: dto.costCenter,
        updatedBy: userId,
        deletedAt: null
      });
      return vehicle.toObject();
    } catch (err: any) {
      if (err && (err.code === 11000 || /duplicate key/i.test(String(err.message)))) {
        throw new ConflictException({ code: 'PLATE_TAKEN', message: 'Placa já cadastrada para este tenant' });
      }
      throw err;
    }
  }

  async list(
    tenantId: string,
    filters: {
      text?: string;
      teamId?: string;
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
      sort?: 'createdAt' | 'odometer' | 'plate';
      order?: 'asc' | 'desc';
    }
  ) {
    const query: any = { tenantId, deletedAt: null };
    if (filters.text) {
      const regex = new RegExp(filters.text, 'i');
      query.$or = [{ plate: regex }, { model: regex }];
    }
    if (filters.teamId) query.teamId = filters.teamId;
    if (filters.from || filters.to) {
      query.createdAt = {};
      if (filters.from) query.createdAt.$gte = new Date(filters.from);
      if (filters.to) query.createdAt.$lte = new Date(filters.to);
    }
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
    const skip = (page - 1) * limit;
    const sortField = (filters.sort && ['createdAt', 'odometer', 'plate'].includes(filters.sort)
      ? filters.sort
      : 'createdAt') as 'createdAt' | 'odometer' | 'plate';
    const sortOrder = filters.order === 'asc' ? 1 : -1;
    const sortSpec: any = { [sortField]: sortOrder };

    const [items, total] = await Promise.all([
      this.fleetModel.find(query).sort(sortSpec).skip(skip).limit(limit).lean(),
      this.fleetModel.countDocuments(query)
    ]);
    return { items, page, limit, total };
  }

  async findById(tenantId: string, id: string) {
    const vehicle = await this.fleetModel.findOne({ tenantId, _id: id, deletedAt: null });
    if (!vehicle) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Vehicle not found' });
    }
    return vehicle;
  }

  async addCheck(tenantId: string, id: string, dto: VehicleCheckDto) {
    const vehicle = await this.findById(tenantId, id);
    if (dto.km < vehicle.odometer) {
      throw new BadRequestException({ code: 'ODOMETER_BACKWARDS', message: 'KM informado é menor que o odômetro atual' });
    }
    vehicle.checks.push({ ...dto, photos: [] } as any);
    vehicle.odometer = Math.max(vehicle.odometer, dto.km);
    await vehicle.save();
    return vehicle.toObject();
  }

  async addFuel(tenantId: string, id: string, dto: VehicleFuelDto, userId: string) {
    const vehicle = await this.findById(tenantId, id);
    if (dto.km < vehicle.odometer) {
      throw new BadRequestException({ code: 'ODOMETER_BACKWARDS', message: 'KM informado é menor que o odômetro atual' });
    }
    const at = (dto as any).at instanceof Date ? (dto as any).at : new Date((dto as any).at);
    const fuelType = String(dto.fuelType);
    vehicle.fuelLogs.push({
      at,
      km: dto.km,
      liters: dto.liters,
      fuelType,
      cost: dto.cost
    } as any);
    vehicle.odometer = Math.max(vehicle.odometer, dto.km);
    await vehicle.save();
    await this.recordFleetExpense({
      tenantId,
      userId,
      amount: dto.cost,
      date: at,
      category: 'fleet_fuel',
      description: `Abastecimento ${vehicle.plate} (${dto.liters}L ${fuelType})`,
      ref: `fleet:fuel:${vehicle.id ?? vehicle._id}:${at.toISOString()}`
    });
    return vehicle.toObject();
  }

  async events(
    tenantId: string,
    id: string,
    filters?: { from?: string; to?: string; type?: 'check' | 'fuel' | 'maintenance'; order?: 'asc' | 'desc'; page?: number; limit?: number }
  ) {
    const vehicle = await this.findById(tenantId, id);
    const events: any[] = [];

    for (const c of vehicle.checks || []) {
      events.push({ type: 'check', at: c.at, km: c.km, fuelLevel: c.fuelLevel, notes: c.notes });
    }
    for (const f of vehicle.fuelLogs || []) {
      events.push({ type: 'fuel', at: f.at, km: f.km, liters: f.liters, cost: f.cost, fuelType: f.fuelType });
    }
    for (const m of vehicle.maintenances || []) {
      events.push({ type: 'maintenance', at: m.at, atKm: m.atKm, cost: m.cost, notes: m.notes });
    }

    const fromDate = filters?.from ? new Date(filters.from) : undefined;
    const toDate = filters?.to ? new Date(filters.to) : undefined;
    const type = filters?.type;
    let filtered = events.filter((e) => {
      if (type && e.type !== type) return false;
      if (fromDate && new Date(e.at) < fromDate) return false;
      if (toDate && new Date(e.at) > toDate) return false;
      return true;
    });

    const order = filters?.order === 'asc' ? 1 : -1;
    filtered = filtered.sort((a, b) => (new Date(a.at).getTime() - new Date(b.at).getTime()) * order);

    const page = Math.max(1, Number(filters?.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(filters?.limit) || 50));
    const start = (page - 1) * limit;
    const items = filtered.slice(start, start + limit);
    return { items, page, limit, total: filtered.length };
  }

  async addMaintenance(tenantId: string, id: string, dto: VehicleMaintenanceDto, userId: string) {
    const vehicle = await this.findById(tenantId, id);
    if (dto.atKm < vehicle.odometer) {
      throw new BadRequestException({ code: 'ODOMETER_BACKWARDS', message: 'KM informado é menor que o odômetro atual' });
    }
    vehicle.maintenances.push(dto as any);
    vehicle.odometer = Math.max(vehicle.odometer, dto.atKm);
    await vehicle.save();
    const date = (dto as any).at instanceof Date ? (dto as any).at : new Date((dto as any).at);
    await this.recordFleetExpense({
      tenantId,
      userId,
      amount: dto.cost,
      date,
      category: 'fleet_maintenance',
      description: `Manutenção ${vehicle.plate}: ${dto.type}`,
      ref: `fleet:maint:${vehicle.id ?? vehicle._id}:${date.toISOString()}`
    });
    return vehicle.toObject();
  }

  async update(
    tenantId: string,
    id: string,
    dto: Partial<{ plate: string; model?: string; year?: number; teamId?: string; odometer?: number; costCenter?: string }>,
    userId: string
  ) {
    const vehicle = await this.findById(tenantId, id);
    if (dto.odometer !== undefined && dto.odometer < vehicle.odometer) {
      throw new BadRequestException({ code: 'ODOMETER_BACKWARDS', message: 'KM informado é menor que o odômetro atual' });
    }
    if (dto.plate !== undefined) vehicle.plate = dto.plate;
    if (dto.model !== undefined) (vehicle as any).model = dto.model;
    if (dto.year !== undefined) vehicle.year = dto.year as any;
    if (dto.teamId !== undefined) vehicle.teamId = dto.teamId;
    if (dto.odometer !== undefined) vehicle.odometer = dto.odometer as any;
    if (dto.costCenter !== undefined) vehicle.costCenter = dto.costCenter;
    vehicle.updatedBy = userId;
    try {
      await vehicle.save();
    } catch (err: any) {
      if (err && (err.code === 11000 || /duplicate key/i.test(String(err.message)))) {
        throw new ConflictException({ code: 'PLATE_TAKEN', message: 'Placa já cadastrada para este tenant' });
      }
      throw err;
    }
    return vehicle.toObject();
  }

  async remove(tenantId: string, id: string, userId: string) {
    const vehicle = await this.findById(tenantId, id);
    vehicle.deletedAt = new Date();
    vehicle.updatedBy = userId;
    await vehicle.save();
    return vehicle.toObject();
  }

  private async recordFleetExpense(params: {
    tenantId: string;
    userId: string;
    amount: number;
    date: Date;
    category: 'fleet_fuel' | 'fleet_maintenance';
    description: string;
    ref: string;
  }) {
    const { tenantId, userId, amount, date, category, description, ref } = params;
    if (!amount || amount <= 0) {
      return;
    }
    const tx = await this.financeService.create(
      tenantId,
      {
        type: 'payable',
        ref,
        category,
        description,
        dueDate: date,
        amount
      },
      userId
    );
    const txId = tx?._id?.toString?.() ?? tx?._id;
    if (txId) {
      await this.financeService.pay(
        tenantId,
        txId,
        {
          method: 'CASH',
          amount
        },
        userId
      );
    }
  }
}
