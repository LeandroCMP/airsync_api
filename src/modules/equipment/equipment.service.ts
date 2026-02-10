import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Equipment, EquipmentDocument } from './equipment.schema';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { MoveEquipmentDto } from './dto/move-equipment.dto';
import { ReplaceEquipmentDto } from './dto/replace-equipment.dto';
import { EquipmentHistoryService } from '../equipment-history/equipment-history.service';

@Injectable()
export class EquipmentService {
  constructor(
    @InjectModel(Equipment.name) private readonly equipmentModel: Model<EquipmentDocument>,
    private readonly history: EquipmentHistoryService
  ) {}

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
      room: dto.room,
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
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Equipamento nao encontrado.' });
    }
    return equipment;
  }

  async update(tenantId: string, id: string, dto: UpdateEquipmentDto, userId: string) {
    const equipment = await this.findById(tenantId, id);
    if (dto.brand !== undefined) equipment.brand = dto.brand;
    if (dto.model !== undefined) (equipment as any).model = dto.model;
    if (dto.type !== undefined) equipment.type = dto.type;
    if (dto.btus !== undefined) equipment.btus = dto.btus;
    if (dto.installDate !== undefined) equipment.installDate = dto.installDate as any;
    if (dto.serial !== undefined) equipment.serial = dto.serial;
    if (dto.room !== undefined) equipment.room = dto.room;
    if (dto.notes !== undefined) equipment.notes = dto.notes;
    if (dto.lastServiceAt !== undefined) equipment.lastServiceAt = dto.lastServiceAt as any;
    if (dto.nextServiceAt !== undefined) equipment.nextServiceAt = dto.nextServiceAt as any;
    equipment.updatedBy = userId;
    await equipment.save();
    return equipment.toObject();
  }

  async remove(tenantId: string, id: string, userId: string) {
    const equipment = await this.findById(tenantId, id);
    equipment.deletedAt = new Date();
    equipment.updatedBy = userId;
    await equipment.save();
    return equipment.toObject();
  }

  async removeByLocation(tenantId: string, locationId: string, userId: string) {
    const now = new Date();
    await this.equipmentModel.updateMany(
      { tenantId, locationId, deletedAt: null },
      { $set: { deletedAt: now, updatedBy: userId } }
    );
    return { success: true };
  }

  async move(tenantId: string, id: string, dto: MoveEquipmentDto, userId: string) {
    const equipment = await this.findById(tenantId, id);
    const before = equipment.toObject();
    if (dto.toClientId) equipment.clientId = dto.toClientId;
    equipment.locationId = dto.toLocationId;
    equipment.room = dto.toRoom;
    equipment.updatedBy = userId;
    await equipment.save();

    await this.history.add(tenantId, {
      equipmentId: equipment.id,
      type: 'moved',
      notes: dto.notes,
      by: userId,
      meta: {
        from: { clientId: before.clientId, locationId: before.locationId, room: before.room },
        to: { clientId: equipment.clientId, locationId: equipment.locationId, room: equipment.room }
      }
    });

    return equipment.toObject();
  }

  async replace(tenantId: string, id: string, dto: ReplaceEquipmentDto, userId: string) {
    const current = await this.findById(tenantId, id);
    const base = current.toObject();
    const payload: any = {
      tenantId,
      clientId: dto.newEquipment.clientId || base.clientId,
      locationId: dto.newEquipment.locationId || base.locationId,
      brand: dto.newEquipment.brand ?? base.brand,
      model: dto.newEquipment.model ?? base.model,
      type: dto.newEquipment.type ?? base.type,
      btus: dto.newEquipment.btus ?? base.btus,
      installDate: dto.newEquipment.installDate ?? base.installDate,
      serial: dto.newEquipment.serial ?? undefined,
      room: dto.newEquipment.room || base.room,
      notes: dto.newEquipment.notes ?? base.notes,
      updatedBy: userId,
      deletedAt: null
    };
    const created = await this.equipmentModel.create(payload);

    current.replacedBy = created.id;
    current.replacedAt = new Date();
    current.deletedAt = new Date();
    current.updatedBy = userId;
    await current.save();

    await this.history.add(tenantId, {
      equipmentId: current.id,
      type: 'replaced',
      notes: dto.notes,
      by: userId,
      meta: { newEquipmentId: created.id }
    });
    await this.history.add(tenantId, {
      equipmentId: created.id,
      type: 'replaced',
      notes: dto.notes,
      by: userId,
      meta: { oldEquipmentId: current.id }
    });

    return created.toObject();
  }
}
