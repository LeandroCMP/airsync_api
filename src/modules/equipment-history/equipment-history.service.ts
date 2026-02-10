import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EquipmentHistory, EquipmentHistoryDocument } from './equipment-history.schema';

@Injectable()
export class EquipmentHistoryService {
  constructor(
    @InjectModel(EquipmentHistory.name)
    private readonly historyModel: Model<EquipmentHistoryDocument>
  ) {}

  async add(
    tenantId: string,
    data: {
      equipmentId: string;
      orderId?: string;
      type: 'order_created' | 'order_finished' | 'order_rescheduled' | 'moved' | 'replaced';
      at?: Date;
      notes?: string;
      by?: string;
      meta?: any;
    }
  ) {
    const doc = await this.historyModel.create({
      tenantId,
      equipmentId: data.equipmentId,
      orderId: data.orderId,
      type: data.type,
      at: data.at || new Date(),
      notes: data.notes,
      by: data.by,
      meta: data.meta
    });
    return doc.toObject();
  }

  async listByEquipment(tenantId: string, equipmentId: string) {
    return this.historyModel.find({ tenantId, equipmentId }).sort({ at: -1, createdAt: -1 }).lean();
  }
}
