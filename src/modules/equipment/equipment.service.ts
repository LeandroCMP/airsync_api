import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Equipment, EquipmentDocument } from './equipment.schema';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';

@Injectable()
export class EquipmentService {
  constructor(@InjectModel(Equipment.name) private readonly equipmentModel: Model<EquipmentDocument>) {}

  async create(tenantId: string, dto: CreateEquipmentDto, userId: string) {
    const equipment = await this.equipmentModel.create({
      tenantId,
      clientId: dto.clientId,
      locationId: dto.locationId,
      brand: dto.brand,
      model: dto.model,
      type: dto.type,
      btus: dto.btus,
      installDate: dto.installDate,
      serial: dto.serial,
      notes: dto.notes,
      updatedBy: userId,
      deletedAt: null
    });
    return equipment.toObject();
  }

  async findAll(tenantId: string, filters: { clientId?: string; locationId?: string }) {
    const query: any = { tenantId, deletedAt: null };
    if (filters.clientId) query.clientId = filters.clientId;
    if (filters.locationId) query.locationId = filters.locationId;
    return this.equipmentModel.find(query).lean();
  }

  async findById(tenantId: string, id: string) {
    const equipment = await this.equipmentModel.findOne({ tenantId, _id: id, deletedAt: null });
    if (!equipment) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Equipment not found' });
    }
    return equipment;
  }

  async update(tenantId: string, id: string, dto: UpdateEquipmentDto, userId: string) {
    const equipment = await this.findById(tenantId, id);
    if (dto.brand !== undefined) equipment.brand = dto.brand;
    if (dto.model !== undefined) equipment.model = dto.model;
    if (dto.type !== undefined) equipment.type = dto.type;
    if (dto.btus !== undefined) equipment.btus = dto.btus;
    if (dto.installDate !== undefined) equipment.installDate = dto.installDate as any;
    if (dto.serial !== undefined) equipment.serial = dto.serial;
    if (dto.notes !== undefined) equipment.notes = dto.notes;
    if (dto.lastServiceAt !== undefined) equipment.lastServiceAt = dto.lastServiceAt as any;
    if (dto.nextServiceAt !== undefined) equipment.nextServiceAt = dto.nextServiceAt as any;
    equipment.updatedBy = userId;
    await equipment.save();
    return equipment.toObject();
  }
}
