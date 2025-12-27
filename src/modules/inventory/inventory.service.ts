import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ClientSession } from 'mongoose';
import { InventoryItem, InventoryItemDocument } from './inventory-item.schema';
import { InventoryCategory, InventoryCategoryDocument } from './inventory-category.schema';
import { CreateInventoryItemDto } from './dto/create-item.dto';
import { UpdateInventoryItemDto } from './dto/update-item.dto';
import { CreateInventoryMovementDto } from './dto/create-movement.dto';
import { SearchInventoryItemsDto, StockStatusFilter } from './dto/search-items.dto';
import { calculateSellPrice } from './pricing.util';

export type StockSeverity = 'critical' | 'below_minimum' | 'adequate';

export interface DecoratedInventoryItem {
  minimumQuantity: number;
  criticalThreshold: number;
  isBelowMinimum: boolean;
  isCriticalStock: boolean;
  stockSeverity: StockSeverity;
  suggestedSellPrice?: number;
  priceDeviationPercent?: number;
  priceDeviationValue?: number;
  pricingMode?: 'manual' | 'category';
  [key: string]: any;
}

@Injectable()
export class InventoryService {
  private static readonly COST_HISTORY_LIMIT = 20;
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    @InjectModel(InventoryItem.name) private readonly inventoryModel: Model<InventoryItemDocument>,
    @InjectModel(InventoryCategory.name)
    private readonly categoryModel: Model<InventoryCategoryDocument>
  ) {}

  private generateSku(name?: string) {
    const base =
      name
        ?.toLowerCase()
        ?.replace(/[^a-z0-9]+/g, '-')
        ?.replace(/^-+|-+$/g, '') || 'item';
    const suffix = Date.now().toString(36);
    return `${base}-${suffix}`;
  }

  private async getCategory(tenantId: string, categoryId?: string | null) {
    if (!categoryId) {
      return null;
    }
    const category = await this.categoryModel.findOne({ tenantId, _id: categoryId });
    if (!category) {
      throw new NotFoundException({ code: 'CATEGORY_NOT_FOUND', message: 'Inventory category not found' });
    }
    return category;
  }

  private appendCostHistory(item: InventoryItemDocument, cost?: number, source?: string) {
    if (typeof cost !== 'number' || Number.isNaN(cost)) {
      return;
    }
    if (!item.costHistory) {
      item.costHistory = [];
    }
    item.costHistory.push({ cost, at: new Date(), source });
    if (item.costHistory.length > InventoryService.COST_HISTORY_LIMIT) {
      item.costHistory.splice(0, item.costHistory.length - InventoryService.COST_HISTORY_LIMIT);
    }
  }

  async createItem(tenantId: string, dto: CreateInventoryItemDto, userId: string) {
    const resolvedCategoryId = dto.categoryId || null;
    const categoryDoc = resolvedCategoryId ? await this.getCategory(tenantId, resolvedCategoryId) : null;
    let pricingMode: 'manual' | 'category' =
      dto.pricingMode ??
      (dto.markupPercent !== undefined ? 'manual' : resolvedCategoryId ? 'category' : 'manual');

    let markupPercent = dto.markupPercent ?? 0;
    if (pricingMode === 'category') {
      if (!resolvedCategoryId || !categoryDoc) {
        throw new BadRequestException({
          code: 'CATEGORY_REQUIRED',
          message: 'Selecione uma categoria para precificacao por categoria.'
        });
      }
      markupPercent = categoryDoc.markupPercent ?? 0;
    }

    const computedSellPrice =
      dto.sellPrice !== undefined ? dto.sellPrice : calculateSellPrice(dto.avgCost, markupPercent);
    const initialCostHistory =
      typeof dto.avgCost === 'number'
        ? [{ cost: dto.avgCost, at: new Date(), source: 'initial' }]
        : [];

    const item = await this.inventoryModel.create({
      tenantId,
      name: dto.name,
      sku: dto.sku?.trim() || this.generateSku(dto.name),
      unit: dto.unit || 'un',
      minQty: dto.minQty || 0,
      maxQty: dto.maxQty,
      supplierId: dto.supplierId,
      categoryId: resolvedCategoryId,
      avgCost: dto.avgCost,
      sellPrice: computedSellPrice,
      markupPercent,
      pricingMode,
      lastPurchaseCost: dto.avgCost,
      costHistory: initialCostHistory,
      onHand: 0,
      reserved: 0,
      updatedBy: userId,
      deletedAt: null
    });
    this.logger.log(
      `Item criado | tenant=${tenantId} id=${item._id.toString()} nome=${item.name} sku=${item.sku}`
    );
    return item.toObject();
  }

  async updateItem(tenantId: string, id: string, dto: UpdateInventoryItemDto, userId: string) {
    const item = await this.inventoryModel.findOne({ tenantId, _id: id, deletedAt: null });
    if (!item) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Item de estoque nao encontrado.' });
    }
    let avgCostUpdated = false;
    if (dto.name !== undefined) item.name = dto.name;
    if (dto.unit !== undefined) item.unit = dto.unit;
    if (dto.minQty !== undefined) item.minQty = dto.minQty;
    if (dto.maxQty !== undefined) item.maxQty = dto.maxQty;
    if (dto.supplierId !== undefined) item.supplierId = dto.supplierId;
    if (dto.categoryId !== undefined) {
      if (dto.categoryId) {
        await this.getCategory(tenantId, dto.categoryId);
        item.categoryId = dto.categoryId;
      } else {
        item.categoryId = null;
      }
    }
    if (dto.avgCost !== undefined) {
      item.avgCost = dto.avgCost;
      this.appendCostHistory(item, dto.avgCost, 'manual_adjustment');
      avgCostUpdated = true;
    }

    let pricingMode: 'manual' | 'category' = dto.pricingMode ?? item.pricingMode ?? 'manual';
    item.pricingMode = pricingMode;

    let markupPercent = item.markupPercent ?? 0;
    if (pricingMode === 'category') {
      const targetCategoryId = item.categoryId || dto.categoryId;
      if (!targetCategoryId) {
        throw new BadRequestException({
          code: 'CATEGORY_REQUIRED',
          message: 'Selecione uma categoria para precificacao por categoria.'
        });
      }
      const category = await this.getCategory(tenantId, targetCategoryId);
      item.categoryId = targetCategoryId;
      markupPercent = category.markupPercent ?? 0;
    } else if (dto.markupPercent !== undefined) {
      markupPercent = dto.markupPercent;
    } else if (item.markupPercent === undefined) {
      markupPercent = 0;
    }
    item.markupPercent = markupPercent;

    let shouldRecalculatePrice = avgCostUpdated || pricingMode === 'category';
    if (dto.markupPercent !== undefined) {
      shouldRecalculatePrice = true;
    }

    if (dto.sellPrice !== undefined) {
      item.sellPrice = dto.sellPrice;
      shouldRecalculatePrice = false;
    }

    if (shouldRecalculatePrice) {
      const recalculated = calculateSellPrice(item.avgCost, item.markupPercent);
      if (recalculated !== undefined) {
        item.sellPrice = recalculated;
      }
    }

    item.updatedBy = userId;
    await item.save();
    this.logger.log(`Item atualizado | tenant=${tenantId} id=${id}`);
    return item.toObject();
  }

  async search(tenantId: string, filters: SearchInventoryItemsDto) {
    const query: any = { tenantId, deletedAt: null };

    if (filters?.itemId) {
      query._id = filters.itemId;
    }
    if (filters?.sku) {
      query.sku = filters.sku;
    }
    if (filters?.text) {
      const regex = new RegExp(filters.text, 'i');
      query.$or = [{ name: regex }, { sku: regex }];
    }

    const stockStatus = filters?.stockStatus ?? StockStatusFilter.ALL;

    const items = await this.inventoryModel.find(query).lean();
    const decorated = items.map((item) => this.decorateListItem(item));

    const filtered = decorated.filter((item) => {
      if (stockStatus === StockStatusFilter.CRITICAL) {
        return item.isCriticalStock;
      }
      if (stockStatus === StockStatusFilter.BELOW_MINIMUM) {
        return item.isBelowMinimum;
      }
      return true;
    });

    const severityOrder: Record<StockSeverity, number> = {
      critical: 0,
      below_minimum: 1,
      adequate: 2
    };

    return filtered.sort((a, b) => {
      const severityDiff = severityOrder[a.stockSeverity] - severityOrder[b.stockSeverity];
      if (severityDiff !== 0) {
        return severityDiff;
      }
      if (a.name && b.name) {
        return String(a.name).localeCompare(String(b.name));
      }
      return 0;
    });
  }

  async findById(tenantId: string, id: string, session?: ClientSession | null) {
    const query = this.inventoryModel.findOne({ tenantId, _id: id, deletedAt: null });
    if (session) {
      query.session(session);
    }
    const item = await query;
    if (!item) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Item de estoque nao encontrado.' });
    }
    return item;
  }

  async getCategoryInfo(tenantId: string, categoryId: string) {
    if (!categoryId) {
      return null;
    }
    return this.categoryModel.findOne({ tenantId, _id: categoryId }).lean();
  }

  async getCostHistory(tenantId: string, id: string) {
    const item = await this.findById(tenantId, id);
    return (item.costHistory || []).map((entry) => ({
      cost: entry.cost,
      at: entry.at,
      source: entry.source
    }));
  }

  async recordMovement(
    tenantId: string,
    dto: CreateInventoryMovementDto,
    userId: string,
    session?: ClientSession | null
  ) {
    if (dto.qty <= 0) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Quantidade deve ser positiva.' });
    }
    const item = await this.findById(tenantId, dto.itemId, session);
    const available = item.onHand - item.reserved;

    switch (dto.type) {
      case 'in': {
        const previousQty = item.onHand;
        const previousCost = (item.avgCost || 0) * previousQty;
        item.onHand += dto.qty;
        if (dto.cost !== undefined) {
          const totalQty = previousQty + dto.qty;
          const totalCost = previousCost + dto.cost * dto.qty;
          item.avgCost = totalQty > 0 ? totalCost / totalQty : item.avgCost;
          item.lastPurchaseCost = dto.cost;
          this.appendCostHistory(item, dto.cost, dto.ref || 'movement');
        }
        if (item.markupPercent !== undefined && item.avgCost !== undefined) {
          const updatedSellPrice = calculateSellPrice(item.avgCost, item.markupPercent);
          if (updatedSellPrice !== undefined) {
            item.sellPrice = updatedSellPrice;
          }
        }
        break;
      }
      case 'out': {
        if (item.onHand < dto.qty) {
          throw new BadRequestException({ code: 'STOCK_ERROR', message: 'Estoque insuficiente para essa baixa.' });
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
      }
      case 'reserve': {
        if (available < dto.qty) {
          throw new BadRequestException({ code: 'STOCK_RESERVE_ERROR', message: 'Estoque insuficiente para reservar.' });
        }
        if (dto.ref) {
          const existingReserve = item.entries.find((entry) => entry.type === 'reserve' && entry.ref === dto.ref);
          const released = item.entries.find(
            (entry) => entry.ref === dto.ref && (entry.type === 'release' || entry.type === 'out')
          );
          if (existingReserve && !released) {
            throw new BadRequestException({
              code: 'DUPLICATE_RESERVE',
              message: 'Material already reserved for this reference'
            });
          }
        }
        item.reserved += dto.qty;
        break;
      }
      case 'release': {
        item.reserved = Math.max(0, item.reserved - dto.qty);
        break;
      }
      default:
        throw new BadRequestException({ code: 'UNSUPPORTED_MOVEMENT', message: 'Unsupported movement type' });
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

  async rebalance(tenantId: string, days = 30) {
    const window = Math.max(1, Number(days) || 30);
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - window);
    const items = await this.inventoryModel.find({ tenantId, deletedAt: null }).lean();
    const suggestions = [];
    for (const item of items) {
      const entries = Array.isArray(item.entries) ? item.entries : [];
      const recentOut = entries.filter(
        (entry: any) =>
          entry.type === 'out' && entry.at && new Date(entry.at).getTime() >= fromDate.getTime()
      );
      const totalOut = recentOut.reduce((sum: number, entry: any) => sum + (entry.qty || 0), 0);
      const dailyUsage = totalOut / window;
      const available = (item.onHand || 0) - (item.reserved || 0);
      const safetyStock = item.minQty || 0;
      const targetStock = safetyStock + dailyUsage * window;
      const recommended = Math.max(Math.ceil(targetStock - available), 0);
      if (recommended > 0) {
        suggestions.push({
          itemId: item._id,
          name: item.name,
          available,
          minQty: safetyStock,
          dailyUsage: Number(dailyUsage.toFixed(2)),
          recommendedQty: recommended
        });
      }
    }
    return suggestions.sort((a, b) => b.recommendedQty - a.recommendedQty);
  }

  async removeItem(tenantId: string, id: string, userId: string) {
    const item = await this.inventoryModel.findOne({ tenantId, _id: id, deletedAt: null });
    if (!item) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Inventory item not found' });
    }
    if (item.onHand && item.onHand > 0) {
      throw new BadRequestException({
        code: 'CANNOT_DELETE_WITH_STOCK',
        message: 'Nao e possivel excluir: item possui saldo em estoque. Zere a quantidade antes de remover.'
      });
    }
    if (item.reserved && item.reserved > 0) {
      throw new BadRequestException({
        code: 'CANNOT_DELETE_WITH_RESERVED',
        message: 'Nao e possivel excluir: item possui reserva pendente. Libere as reservas antes de remover.'
      });
    }
    item.deletedAt = new Date();
    item.updatedBy = userId;
    await item.save();
    this.logger.log(`Item removido (soft) | tenant=${tenantId} id=${id}`);
    return item.toObject();
  }

  private decorateListItem(item: any): DecoratedInventoryItem {
    const minQty = typeof item.minQty === 'number' ? item.minQty : 0;
    const onHand = typeof item.onHand === 'number' ? item.onHand : 0;

    const belowMinimum = minQty > 0 ? onHand <= minQty : false;
    const criticalThresholdValue = minQty > 0 ? Number((minQty * 0.3).toFixed(3)) : 0;
    const critical = minQty > 0 ? onHand <= criticalThresholdValue : false;

    const stockSeverity: StockSeverity = critical
      ? 'critical'
      : belowMinimum
      ? 'below_minimum'
      : 'adequate';

    const suggestedSellPrice = calculateSellPrice(item.avgCost, item.markupPercent);
    const sellPrice = typeof item.sellPrice === 'number' ? item.sellPrice : undefined;
    const priceDeviationValue =
      sellPrice !== undefined && suggestedSellPrice !== undefined
        ? Number((sellPrice - suggestedSellPrice).toFixed(2))
        : 0;
    const priceDeviationPercent =
      sellPrice !== undefined && suggestedSellPrice
        ? Number((((sellPrice - suggestedSellPrice) / suggestedSellPrice) * 100).toFixed(2))
        : 0;

    return {
      ...item,
      minimumQuantity: minQty,
      criticalThreshold: criticalThresholdValue,
      isBelowMinimum: belowMinimum,
      isCriticalStock: critical,
      stockSeverity,
      suggestedSellPrice,
      priceDeviationValue,
      priceDeviationPercent,
      pricingMode: item.pricingMode || 'manual'
    };
  }
}
