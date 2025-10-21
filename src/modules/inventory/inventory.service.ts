import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ClientSession } from 'mongoose';
import { InventoryItem, InventoryItemDocument } from './inventory-item.schema';
import { CreateInventoryItemDto } from './dto/create-item.dto';
import { UpdateInventoryItemDto } from './dto/update-item.dto';
import { CreateInventoryMovementDto } from './dto/create-movement.dto';

@Injectable()
export class InventoryService {
  constructor(
    @InjectModel(InventoryItem.name) private readonly inventoryModel: Model<InventoryItemDocument>
  ) {}

  async createItem(tenantId: string, dto: CreateInventoryItemDto, userId: string) {
    const item = await this.inventoryModel.create({
      tenantId,
      name: dto.name,
      sku: dto.sku,
      barcode: dto.barcode,
      unit: dto.unit || 'un',
      minQty: dto.minQty || 0,
      maxQty: dto.maxQty,
      supplierId: dto.supplierId,
      avgCost: dto.avgCost,
      sellPrice: dto.sellPrice,
      onHand: 0,
      reserved: 0,
      updatedBy: userId,
      deletedAt: null
    });
    return item.toObject();
  }

  async updateItem(tenantId: string, id: string, dto: UpdateInventoryItemDto, userId: string) {
    const item = await this.inventoryModel.findOne({ tenantId, _id: id, deletedAt: null });
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Inventory item not found' });
    if (dto.name !== undefined) item.name = dto.name;
    if (dto.barcode !== undefined) item.barcode = dto.barcode;
    if (dto.unit !== undefined) item.unit = dto.unit;
    if (dto.minQty !== undefined) item.minQty = dto.minQty;
    if (dto.maxQty !== undefined) item.maxQty = dto.maxQty;
    if (dto.supplierId !== undefined) item.supplierId = dto.supplierId;
    if (dto.avgCost !== undefined) item.avgCost = dto.avgCost;
    if (dto.sellPrice !== undefined) item.sellPrice = dto.sellPrice;
    item.updatedBy = userId;
    await item.save();
    return item.toObject();
  }

  async search(tenantId: string, text?: string) {
    const query: any = { tenantId, deletedAt: null };
    if (text) {
      const regex = new RegExp(text, 'i');
      query.$or = [{ name: regex }, { sku: regex }, { barcode: regex }];
    }
    return this.inventoryModel.find(query).lean();
  }

  async findById(tenantId: string, id: string, session?: ClientSession | null) {
    const query = this.inventoryModel.findOne({ tenantId, _id: id, deletedAt: null });
    if (session) {
      query.session(session);
    }
    const item = await query;
    if (!item) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Inventory item not found' });
    }
    return item;
  }

  async recordMovement(
    tenantId: string,
    dto: CreateInventoryMovementDto,
    userId: string,
    session?: ClientSession | null
  ) {
    if (dto.qty <= 0) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Quantity must be positive' });
    }
    const item = await this.findById(tenantId, dto.itemId, session);
    const available = item.onHand - item.reserved;

    switch (dto.type) {
      case 'in':
        const previousQty = item.onHand;
        const previousCost = (item.avgCost || 0) * previousQty;
        item.onHand += dto.qty;
        if (dto.cost !== undefined) {
          const totalQty = previousQty + dto.qty;
          const totalCost = previousCost + dto.cost * dto.qty;
          item.avgCost = totalQty > 0 ? totalCost / totalQty : item.avgCost;
        }
        break;
      case 'out':
        if (item.onHand < dto.qty) {
          throw new BadRequestException({ code: 'STOCK_ERROR', message: 'Insufficient stock' });
        }
        item.onHand -= dto.qty;
        if (dto.ref) {
          if (item.reserved < dto.qty) {
            item.reserved = Math.max(0, item.reserved - dto.qty);
          } else {
            item.reserved -= dto.qty;
          }
        }
        break;
      case 'reserve':
        if (available < dto.qty) {
          throw new BadRequestException({ code: 'STOCK_RESERVE_ERROR', message: 'Not enough stock to reserve' });
        }
        if (dto.ref) {
          const existingReserve = item.entries.find((entry) => entry.type === 'reserve' && entry.ref === dto.ref);
          const released = item.entries.find(
            (entry) => entry.ref === dto.ref && (entry.type === 'release' || entry.type === 'out')
          );
          if (existingReserve && !released) {
            throw new BadRequestException({ code: 'DUPLICATE_RESERVE', message: 'Material already reserved for this reference' });
          }
        }
        item.reserved += dto.qty;
        break;
      case 'release':
        item.reserved = Math.max(0, item.reserved - dto.qty);
        break;
    }

    item.entries.push({
      type: dto.type,
      qty: dto.qty,
      cost: dto.cost,
      ref: dto.ref,
      lot: dto.lot,
      at: new Date()
    } as any);
    item.updatedBy = userId;
    const saveOptions = session ? { session } : undefined;
    await item.save(saveOptions);
    return item.toObject();
  }

  async reserveForOrder(
    tenantId: string,
    orderId: string,
    materials: { itemId: string; qty: number }[],
    userId: string,
    session?: ClientSession | null
  ) {
    for (const material of materials) {
      await this.recordMovement(
        tenantId,
        { itemId: material.itemId, qty: material.qty, type: 'reserve', ref: orderId },
        userId,
        session || undefined
      );
    }
  }

  async releaseForOrder(
    tenantId: string,
    orderId: string,
    materials: { itemId: string; qty: number }[],
    userId: string,
    session?: ClientSession | null
  ) {
    for (const material of materials) {
      await this.recordMovement(
        tenantId,
        { itemId: material.itemId, qty: material.qty, type: 'release', ref: orderId },
        userId,
        session || undefined
      );
    }
  }

  async deductForOrder(
    tenantId: string,
    orderId: string,
    materials: { itemId: string; qty: number }[],
    userId: string,
    session?: ClientSession | null
  ) {
    for (const material of materials) {
      await this.recordMovement(
        tenantId,
        { itemId: material.itemId, qty: material.qty, type: 'out', ref: orderId },
        userId,
        session || undefined
      );
    }
  }

  async lowStock(tenantId: string) {
    return this.inventoryModel
      .find({ tenantId, deletedAt: null, $expr: { $lte: ['$onHand', '$minQty'] } })
      .lean();
  }
}
