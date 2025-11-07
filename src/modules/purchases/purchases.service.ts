import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import { Purchase, PurchaseDocument } from './purchase.schema';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { ReceivePurchaseDto } from './dto/receive-purchase.dto';
import { InventoryService } from '../inventory/inventory.service';
import { executeWithTransactionIfSupported } from '../../common/utils/transaction.util';

@Injectable()
export class PurchasesService {
  constructor(
    @InjectModel(Purchase.name) private readonly purchaseModel: Model<PurchaseDocument>,
    private readonly inventoryService: InventoryService
  ) {}

  async create(tenantId: string, dto: CreatePurchaseDto, userId: string) {
    return executeWithTransactionIfSupported(this.purchaseModel.db, async (session) => {
      const subtotal =
        dto.subtotal ?? dto.items.reduce((acc, item) => acc + item.qty * item.unitCost, 0);
      const total = subtotal + (dto.freight || 0);

      const purchase = new this.purchaseModel({
        tenantId,
        supplierId: dto.supplierId,
        status: dto.status,
        items: dto.items,
        totals: { subtotal, freight: dto.freight || 0, total },
        notes: dto.notes,
        updatedBy: userId
      });

      // Persist purchase first (so we have an id for movement ref)
      await purchase.save(session ? { session } : undefined);

      // If purchase is created as 'received', immediately add to stock and set receivedAt
      if (purchase.status === 'received') {
        purchase.receivedAt = new Date();
        for (const item of purchase.items) {
          await this.inventoryService.recordMovement(
            tenantId,
            { itemId: item.itemId, qty: item.qty, type: 'in', cost: item.unitCost, ref: `purchase:${purchase.id}` },
            userId,
            session || undefined
          );
        }
        await purchase.save(session ? { session } : undefined);
      }

      return purchase.toObject();
    });
  }

  async findById(tenantId: string, id: string) {
    const purchase = await this.purchaseModel.findOne({ tenantId, _id: id, deletedAt: null });
    if (!purchase) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Purchase not found' });
    }
    return purchase;
  }

  async list(
    tenantId: string,
    filters: { status?: string; supplierId?: string; from?: string; to?: string }
  ) {
    const query: any = { tenantId, deletedAt: null };
    if (filters.status) query.status = filters.status;
    if (filters.supplierId) query.supplierId = filters.supplierId;
    if (filters.from || filters.to) {
      query.createdAt = {};
      if (filters.from) query.createdAt.$gte = new Date(filters.from);
      if (filters.to) query.createdAt.$lte = new Date(filters.to);
    }
    return this.purchaseModel.find(query).lean();
  }

  async receive(tenantId: string, id: string, dto: ReceivePurchaseDto, userId: string) {
    return executeWithTransactionIfSupported(this.purchaseModel.db, async (session) => {
      const purchase = await this.loadPurchaseForUpdate(tenantId, id, session);
      if (purchase.status === 'received') {
        throw new BadRequestException({ code: 'PURCHASE_ALREADY_RECEIVED', message: 'Purchase already received' });
      }
      purchase.status = 'received';
      purchase.receivedAt = dto.receivedAt ? new Date(dto.receivedAt) : new Date();
      purchase.updatedBy = userId;
      await purchase.save(session ? { session } : undefined);
      for (const item of purchase.items) {
        await this.inventoryService.recordMovement(
          tenantId,
          { itemId: item.itemId, qty: item.qty, type: 'in', cost: item.unitCost, ref: `purchase:${id}` },
          userId,
          session || undefined
        );
      }
      return purchase.toObject();
    });
  }

  private async loadPurchaseForUpdate(
    tenantId: string,
    id: string,
    session: ClientSession | null
  ): Promise<PurchaseDocument> {
    const query = this.purchaseModel.findOne({ tenantId, _id: id, deletedAt: null });
    if (session) {
      query.session(session);
    }
    const purchase = await query;
    if (!purchase) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Purchase not found' });
    }
    return purchase;
  }
}
