import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import { Purchase, PurchaseDocument } from './purchase.schema';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { ReceivePurchaseDto } from './dto/receive-purchase.dto';
import { CancelPurchaseDto } from './dto/cancel-purchase.dto';
import { InventoryService } from '../inventory/inventory.service';
import { executeWithTransactionIfSupported } from '../../common/utils/transaction.util';
import { FinanceService } from '../finance/finance.service';
import { NotificationService } from '../../core/notifications/notification.service';
import { Order, OrderDocument } from '../orders/order.schema';

const HIGH_COST_THRESHOLD = 0.2;
const LOW_COST_THRESHOLD = -0.2;

@Injectable()
export class PurchasesService {
  constructor(
    @InjectModel(Purchase.name) private readonly purchaseModel: Model<PurchaseDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    private readonly inventoryService: InventoryService,
    private readonly financeService: FinanceService,
    private readonly notificationService: NotificationService
  ) {}

  async create(tenantId: string, dto: CreatePurchaseDto, userId: string) {
    return executeWithTransactionIfSupported(this.purchaseModel.db, async (session) => {
      const subtotal =
        dto.subtotal ?? dto.items.reduce((acc, item) => acc + item.qty * item.unitCost, 0);
      const total = subtotal + (dto.freight || 0);
      const paymentDueDate = dto.paymentDueDate ? new Date(dto.paymentDueDate) : undefined;
      const alerts = await this.evaluateCostAlerts(tenantId, dto.items);
      const classifications = await this.buildClassifications(tenantId, dto.items);

      const purchase = new this.purchaseModel({
        tenantId,
        supplierId: dto.supplierId,
        status: dto.status || 'draft',
        items: dto.items,
        totals: { subtotal, freight: dto.freight || 0, total },
        paymentDueDate,
        alerts,
        classifications,
        notes: dto.notes,
        updatedBy: userId
      });
      this.applyInitialWorkflowState(purchase, userId);
      this.recordHistory(purchase, purchase.status, userId);

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

      await this.ensureFinanceTransaction(tenantId, purchase, userId, session);
      await this.applyOrderAllocations(tenantId, purchase);

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
      if (!['ordered', 'approved'].includes(purchase.status)) {
        throw new BadRequestException({
          code: 'PURCHASE_RECEIVE_INVALID',
          message: 'Purchase must be ordered before receiving'
        });
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
      await this.ensureFinanceTransaction(tenantId, purchase, userId, session);
      await this.applyOrderAllocations(tenantId, purchase);
      this.recordHistory(purchase, purchase.status, userId);
      return purchase.toObject();
    });
  }

  async cancel(tenantId: string, id: string, dto: CancelPurchaseDto, userId: string) {
    return executeWithTransactionIfSupported(this.purchaseModel.db, async (session) => {
      const purchase = await this.loadPurchaseForUpdate(tenantId, id, session);
      if (purchase.status === 'received') {
        throw new BadRequestException({
          code: 'PURCHASE_ALREADY_RECEIVED',
          message: 'Cannot cancel a purchase that has already been received'
        });
      }
      if (purchase.status === 'canceled') {
        throw new BadRequestException({
          code: 'PURCHASE_ALREADY_CANCELED',
          message: 'Purchase already canceled'
        });
      }
      purchase.status = 'canceled';
      purchase.canceledAt = new Date();
      if (dto.reason) {
        purchase.notes = purchase.notes
          ? `${purchase.notes}\nCancelamento: ${dto.reason}`
          : `Cancelamento: ${dto.reason}`;
      }
      purchase.updatedBy = userId;
      await purchase.save(session ? { session } : undefined);
      await this.removeFinanceTransaction(tenantId, purchase, session);
      this.recordHistory(purchase, 'canceled', userId, dto.reason);
      return purchase.toObject();
    });
  }

  private async ensureFinanceTransaction(
    tenantId: string,
    purchase: PurchaseDocument,
    userId: string,
    session: ClientSession | null
  ) {
    const total = purchase.totals?.total ?? 0;
    if (
      total <= 0 ||
      purchase.status === 'canceled' ||
      purchase.status === 'draft' ||
      purchase.financeTransactionId
    ) {
      return;
    }
    const financeTx = await this.financeService.create(
      tenantId,
      {
        type: 'payable',
        ref: `purchase:${purchase.id}`,
        partyId: purchase.supplierId,
        category: 'inventory',
        description: `Compra ${purchase.id}`,
        dueDate: purchase.paymentDueDate ?? new Date(),
        amount: total
      },
      userId,
      session || undefined
    );
    purchase.financeTransactionId = financeTx._id?.toString?.() ?? financeTx._id;
    await purchase.save(session ? { session } : undefined);
  }

  private async removeFinanceTransaction(
    tenantId: string,
    purchase: PurchaseDocument,
    session: ClientSession | null
  ) {
    if (!purchase.financeTransactionId) {
      return;
    }
    await this.financeService.remove(
      tenantId,
      purchase.financeTransactionId,
      session || undefined
    );
    purchase.financeTransactionId = undefined;
    await purchase.save(session ? { session } : undefined);
  }

  private async evaluateCostAlerts(
    tenantId: string,
    items: { itemId: string; unitCost: number }[]
  ) {
    const alerts: { type: 'cost'; itemId: string; message: string; deltaPercent: number }[] = [];
    for (const item of items) {
      let inventory: any = null;
      try {
        inventory = await this.inventoryService.findById(tenantId, item.itemId);
      } catch {
        continue;
      }
      const avgCost = inventory?.avgCost;
      if (!avgCost || avgCost <= 0) {
        continue;
      }
      const delta = (item.unitCost - avgCost) / avgCost;
      if (delta >= HIGH_COST_THRESHOLD || delta <= LOW_COST_THRESHOLD) {
        const deltaPercent = Number((delta * 100).toFixed(2));
        const direction = delta >= 0 ? 'acima' : 'abaixo';
        alerts.push({
          type: 'cost',
          itemId: item.itemId,
          message: `Custo do item ${inventory.name} está ${Math.abs(deltaPercent)}% ${direction} da média (R$${item.unitCost.toFixed(
            2
          )} vs R$${avgCost.toFixed(2)}).`,
          deltaPercent
        });
      }
    }
    return alerts;
  }

  private async buildClassifications(
    tenantId: string,
    items: { itemId: string; qty: number; unitCost: number }[]
  ) {
    const summary = new Map<
      string,
      { categoryId?: string; categoryName?: string; total: number }
    >();
    for (const item of items) {
      let inventory: any = null;
      try {
        inventory = await this.inventoryService.findById(tenantId, item.itemId);
      } catch {
        continue;
      }
      const categoryId = inventory?.categoryId || null;
      let categoryName = 'Sem categoria';
      if (categoryId) {
        const category = await this.inventoryService.getCategoryInfo(tenantId, categoryId);
        if (category?.name) {
          categoryName = category.name;
        }
      }
      const key = categoryId || 'uncategorized';
      const existing = summary.get(key) || {
        categoryId: categoryId || undefined,
        categoryName,
        total: 0
      };
      existing.total += item.qty * item.unitCost;
      existing.categoryName = categoryName;
      summary.set(key, existing);
    }
    return Array.from(summary.values()).sort((a, b) => b.total - a.total);
  }

  private async applyOrderAllocations(tenantId: string, purchase: PurchaseDocument) {
    const map = new Map<
      string,
      {
        amount: number;
        costCenters: Set<string>;
      }
    >();
    for (const item of purchase.items || []) {
      if (!item.orderId) continue;
      const key = String(item.orderId);
      if (!map.has(key)) {
        map.set(key, { amount: 0, costCenters: new Set<string>() });
      }
      const entry = map.get(key)!;
      entry.amount += (item.qty || 0) * (item.unitCost || 0);
      if (item.costCenterId) {
        entry.costCenters.add(item.costCenterId);
      }
    }
    for (const [orderId, entry] of map.entries()) {
      if (!entry.amount) continue;
      const order = await this.orderModel.findOne({ tenantId, _id: orderId, deletedAt: null });
      if (!order) continue;
      const costs = order.costs || {};
      const materials = Number(costs.materials || 0);
      const labor = Number(costs.labor || 0);
      const overhead = Number(costs.overhead || 0);
      const purchasesTotal = Number(costs.purchases || 0) + entry.amount;
      costs.purchases = Number(purchasesTotal.toFixed(2));
      costs.total = Number((materials + labor + overhead + costs.purchases).toFixed(2));
      order.costs = costs;
      const existingCenters = new Set(order.costCenters || []);
      entry.costCenters.forEach((center) => existingCenters.add(center));
      order.costCenters = Array.from(existingCenters);
      await order.save();
    }
  }

  async submit(tenantId: string, id: string, userId: string) {
    const purchase = await this.loadPurchaseForUpdate(tenantId, id, null);
    if (purchase.status !== 'draft') {
      throw new BadRequestException({ code: 'PURCHASE_SUBMIT_INVALID', message: 'Only draft purchases can be submitted' });
    }
    purchase.status = 'pending';
    purchase.submittedAt = new Date();
    purchase.updatedBy = userId;
    this.recordHistory(purchase, 'pending', userId);
    await purchase.save();
    await this.notificationService.notify({
      type: 'purchase_submitted',
      tenantId,
      purchaseId: String(purchase._id),
      by: userId,
      message: `Compra ${purchase.id} enviada para aprovação`
    });
    return purchase.toObject();
  }

  async approve(tenantId: string, id: string, userId: string) {
    const purchase = await this.loadPurchaseForUpdate(tenantId, id, null);
    if (purchase.status !== 'pending') {
      throw new BadRequestException({ code: 'PURCHASE_APPROVE_INVALID', message: 'Only pending purchases can be approved' });
    }
    purchase.status = 'approved';
    purchase.approvedAt = new Date();
    purchase.approvedBy = userId;
    purchase.updatedBy = userId;
    this.recordHistory(purchase, 'approved', userId);
    await purchase.save();
    await this.notificationService.notify({
      type: 'purchase_approved',
      tenantId,
      purchaseId: String(purchase._id),
      by: userId,
      message: `Compra ${purchase.id} aprovada`
    });
    return purchase.toObject();
  }

  async markOrdered(tenantId: string, id: string, userId: string) {
    const purchase = await this.loadPurchaseForUpdate(tenantId, id, null);
    if (purchase.status !== 'approved') {
      throw new BadRequestException({ code: 'PURCHASE_ORDER_INVALID', message: 'Only approved purchases can be marked as ordered' });
    }
    purchase.status = 'ordered';
    purchase.orderedAt = new Date();
    purchase.updatedBy = userId;
    this.recordHistory(purchase, 'ordered', userId);
    await purchase.save();
    await this.ensureFinanceTransaction(tenantId, purchase, userId, null);
    await this.notificationService.notify({
      type: 'purchase_ordered',
      tenantId,
      purchaseId: String(purchase._id),
      by: userId,
      message: `Compra ${purchase.id} marcada como pedida`
    });
    return purchase.toObject();
  }

  private applyInitialWorkflowState(purchase: PurchaseDocument, userId: string) {
    const now = new Date();
    switch (purchase.status) {
      case 'pending':
        purchase.submittedAt = purchase.submittedAt ?? now;
        break;
      case 'approved':
        purchase.submittedAt = purchase.submittedAt ?? now;
        purchase.approvedAt = purchase.approvedAt ?? now;
        purchase.approvedBy = purchase.approvedBy ?? userId;
        break;
      case 'ordered':
        purchase.submittedAt = purchase.submittedAt ?? now;
        purchase.approvedAt = purchase.approvedAt ?? now;
        purchase.approvedBy = purchase.approvedBy ?? userId;
        purchase.orderedAt = purchase.orderedAt ?? now;
        break;
      default:
        break;
    }
  }

  private recordHistory(
    purchase: PurchaseDocument,
    status: string,
    by?: string,
    note?: string
  ) {
    purchase.history = purchase.history || [];
    purchase.history.push({
      status,
      at: new Date(),
      by,
      note
    } as any);
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
