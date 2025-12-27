import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ServiceType, ServiceTypeDocument } from './service-type.schema';
import {
  MaintenanceReminder,
  MaintenanceReminderDocument,
  MaintenanceReminderStatus
} from './maintenance-reminder.schema';
import { OrderDocument } from './order.schema';

@Injectable()
export class MaintenanceService {
  constructor(
    @InjectModel(ServiceType.name) private readonly serviceTypeModel: Model<ServiceTypeDocument>,
    @InjectModel(MaintenanceReminder.name)
    private readonly reminderModel: Model<MaintenanceReminderDocument>
  ) {}

  async listServiceTypes(tenantId: string) {
    return this.serviceTypeModel.find({ tenantId }).sort({ name: 1 }).lean();
  }

  async createServiceType(tenantId: string, dto: Partial<ServiceType>) {
    if (!dto.code || !dto.name) {
      throw new BadRequestException({
        code: 'INVALID_SERVICE_TYPE',
        message: 'code e name sao obrigatorios'
      });
    }
    return this.serviceTypeModel.create({
      tenantId,
      code: dto.code.trim(),
      name: dto.name.trim(),
      defaultIntervalDays: dto.defaultIntervalDays ?? 90,
      defaultIntervalKm: dto.defaultIntervalKm,
      customizable: dto.customizable ?? true,
      active: dto.active ?? true,
      notes: dto.notes
    });
  }

  async updateServiceType(tenantId: string, code: string, dto: Partial<ServiceType>) {
    const type = await this.serviceTypeModel.findOne({ tenantId, code });
    if (!type) {
      throw new BadRequestException({ code: 'SERVICE_TYPE_NOT_FOUND', message: 'Tipo de servico nao encontrado' });
    }
    if (dto.name !== undefined) type.name = dto.name;
    if (dto.defaultIntervalDays !== undefined) type.defaultIntervalDays = dto.defaultIntervalDays;
    if (dto.defaultIntervalKm !== undefined) type.defaultIntervalKm = dto.defaultIntervalKm;
    if (dto.customizable !== undefined) type.customizable = dto.customizable;
    if (dto.active !== undefined) type.active = dto.active;
    if (dto.notes !== undefined) type.notes = dto.notes;
    await type.save();
    return type.toObject();
  }

  async listReminders(
    tenantId: string,
    filters: { equipmentId?: string; status?: MaintenanceReminderStatus; from?: string; to?: string }
  ) {
    const query: any = { tenantId };
    if (filters.equipmentId) query.equipmentId = filters.equipmentId;
    if (filters.status) query.status = filters.status;
    if (filters.from || filters.to) {
      query.nextDueAt = {};
      if (filters.from) query.nextDueAt.$gte = new Date(filters.from);
      if (filters.to) query.nextDueAt.$lte = new Date(filters.to);
    }
    return this.reminderModel.find(query).sort({ nextDueAt: 1 }).lean();
  }

  private addDays(date: Date, days: number) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  async upsertRemindersFromOrder(order: OrderDocument) {
    if (!order?.equipmentId) {
      return;
    }
    const items = (order.billing?.items || []).filter((item: any) => item.type === 'service');
    if (!items.length) {
      return;
    }
    const codes = Array.from(
      new Set(
        items
          .map((item: any) => item.serviceTypeCode)
          .filter((code) => !!code)
      )
    );
    const types = codes.length
      ? await this.serviceTypeModel.find({ tenantId: order.tenantId, code: { $in: codes } }).lean()
      : [];
    const typeMap = new Map(types.map((t: any) => [t.code, t]));
    const baseDate = order.scheduledAt || order.finishedAt || new Date();

    for (const item of items) {
      const type = item.serviceTypeCode ? typeMap.get(item.serviceTypeCode) : null;
      const interval = item.nextMaintenanceInDays ?? type?.defaultIntervalDays;
      if (!interval || interval <= 0) {
        continue;
      }
      const nextDueAt = this.addDays(baseDate, interval);
      const serviceCode = item.serviceTypeCode || item.name;
      await this.reminderModel.findOneAndUpdate(
        {
          tenantId: order.tenantId,
          equipmentId: order.equipmentId,
          serviceTypeCode: serviceCode
        },
        {
          tenantId: order.tenantId,
          equipmentId: order.equipmentId,
          orderId: order._id.toString(),
          serviceTypeCode: serviceCode,
          serviceName: item.name,
          nextDueAt,
          status: 'pending',
          scheduledAt: baseDate
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
  }
}
