import {
  BadRequestException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  SaleOrder,
  SaleOrderDocument
} from './sales-order.schema';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { InventoryService } from '../inventory/inventory.service';
import { OrdersService } from '../orders/orders.service';
import { FinanceService } from '../finance/finance.service';
import { EquipmentService } from '../equipment/equipment.service';

@Injectable()
export class SalesService {
  constructor(
    @InjectModel(SaleOrder.name) private readonly saleModel: Model<SaleOrderDocument>,
    private readonly inventoryService: InventoryService,
    private readonly ordersService: OrdersService,
    private readonly financeService: FinanceService,
    private readonly equipmentService: EquipmentService
  ) {}

  async create(tenantId: string, dto: CreateSaleDto, userId: string) {
    const items = await this.hydrateItems(tenantId, dto.items || []);
    const totals = this.computeTotals(items, dto.discount);
    const requiresInstall =
      items.some((item) => item.requiresInstallation) || !!dto.moveRequest;
    const sale = new this.saleModel({
      tenantId,
      clientId: dto.clientId,
      locationId: dto.locationId,
      costCenterId: dto.costCenterId,
      items,
      totals,
      installationRequired: requiresInstall,
      autoCreateOrder: !!dto.autoCreateOrder,
      moveRequest: dto.moveRequest,
      notes: dto.notes,
      history: []
    });
    this.recordHistory(sale, 'draft', userId);
    await sale.save();
    if (sale.autoCreateOrder) {
      return this.approve(tenantId, sale.id, userId, { forceOrder: true });
    }
    return sale.toObject();
  }

  async list(
    tenantId: string,
    filters: { status?: string; clientId?: string; locationId?: string }
  ) {
    const query: any = { tenantId, deletedAt: null };
    if (filters.status) query.status = filters.status;
    if (filters.clientId) query.clientId = filters.clientId;
    if (filters.locationId) query.locationId = filters.locationId;
    return this.saleModel.find(query).lean();
  }

  async findById(tenantId: string, id: string) {
    const sale = await this.saleModel.findOne({ tenantId, _id: id, deletedAt: null });
    if (!sale) {
      throw new NotFoundException({ code: 'SALE_NOT_FOUND', message: 'Sale not found' });
    }
    return sale;
  }

  async update(tenantId: string, id: string, dto: UpdateSaleDto, userId: string) {
    const sale = await this.findById(tenantId, id);
    if (sale.status !== 'draft' && sale.status !== 'quoted') {
      throw new BadRequestException({
        code: 'SALE_UPDATE_FORBIDDEN',
        message: 'Only draft or quoted sales can be updated'
      });
    }
    if (dto.clientId !== undefined) sale.clientId = dto.clientId;
    if (dto.locationId !== undefined) sale.locationId = dto.locationId;
    if (dto.costCenterId !== undefined) sale.costCenterId = dto.costCenterId;
    if (dto.notes !== undefined) sale.notes = dto.notes;
    if (dto.autoCreateOrder !== undefined) sale.autoCreateOrder = dto.autoCreateOrder;
    if (dto.moveRequest !== undefined) sale.moveRequest = dto.moveRequest as any;
    if (dto.items) {
      sale.items = await this.hydrateItems(tenantId, dto.items);
      sale.installationRequired = sale.items.some((item) => item.requiresInstallation);
    }
    if (dto.discount !== undefined) {
      sale.totals.discount = dto.discount;
    }
    if (dto.moveRequest !== undefined || dto.items) {
      sale.installationRequired =
        sale.items.some((item) => item.requiresInstallation) || !!sale.moveRequest;
    }
    sale.totals = this.computeTotals(sale.items, sale.totals.discount);
    await sale.save();
    return sale.toObject();
  }

  async approve(
    tenantId: string,
    id: string,
    userId: string,
    options?: { forceOrder?: boolean }
  ) {
    const sale = await this.findById(tenantId, id);
    if (sale.status !== 'draft' && sale.status !== 'quoted') {
      throw new BadRequestException({
        code: 'SALE_APPROVE_INVALID',
        message: 'Sale must be in draft or quoted status to approve'
      });
    }
    sale.status = 'approved';
    const financeTx = await this.financeService.create(
      tenantId,
      {
        type: 'receivable',
        ref: `sale:${sale.id}`,
        partyId: sale.clientId,
        category: 'sales',
        description: `Venda ${sale.id}`,
        dueDate: new Date(),
        amount: sale.totals.total
      },
      userId
    );
    sale.financeTransactionId = financeTx._id?.toString?.() ?? financeTx._id;
    this.recordHistory(sale, 'approved', userId);
    await sale.save();
    const forceOrder = options?.forceOrder ?? sale.autoCreateOrder ?? false;
    await this.launchOrderIfNeeded(tenantId, sale, userId, forceOrder);
    return sale.toObject();
  }

  async fulfill(tenantId: string, id: string, userId: string) {
    const sale = await this.findById(tenantId, id);
    if (sale.status === 'canceled' || sale.status === 'fulfilled') {
      throw new BadRequestException({ code: 'SALE_FULFILL_INVALID', message: 'Sale already finalized' });
    }
    if (sale.linkedOrderId) {
      const order = await this.ordersService.findById(tenantId, sale.linkedOrderId);
      if (order.status !== 'done') {
        throw new BadRequestException({
          code: 'SALE_ORDER_PENDING',
          message: 'Linked work order must be finished before fulfilling the sale'
        });
      }
    }
    if (sale.moveRequest) {
      await this.equipmentService.move(tenantId, sale.moveRequest.equipmentId, sale.moveRequest, userId);
    }
    sale.status = 'fulfilled';
    this.recordHistory(sale, 'fulfilled', userId);
    await sale.save();
    return sale.toObject();
  }

  async cancel(tenantId: string, id: string, userId: string) {
    const sale = await this.findById(tenantId, id);
    if (sale.status === 'fulfilled') {
      throw new BadRequestException({ code: 'SALE_CANCEL_FORBIDDEN', message: 'Cannot cancel a fulfilled sale' });
    }
    sale.status = 'canceled';
    this.recordHistory(sale, 'canceled', userId);
    await sale.save();
    return sale.toObject();
  }

  private computeTotals(items: any[], discount = 0) {
    const subtotal = items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
    const total = Math.max(subtotal - (discount || 0), 0);
    return {
      subtotal: Number(subtotal.toFixed(2)),
      discount: Number((discount || 0).toFixed(2)),
      total: Number(total.toFixed(2))
    };
  }

  private async hydrateItems(tenantId: string, items: any[]) {
    const hydrated = [];
    for (const item of items) {
      let name = item.name;
      if ((!name || !name.trim()) && item.inventoryItemId) {
        const inventoryItem = await this.inventoryService.findById(tenantId, item.inventoryItemId);
        name = inventoryItem.name;
      }
      hydrated.push({
        type: item.type,
        inventoryItemId: item.inventoryItemId,
        name,
        qty: item.qty,
        unitPrice: item.unitPrice,
        requiresInstallation: !!item.requiresInstallation
      });
    }
    return hydrated;
  }

  private async launchOrderIfNeeded(
    tenantId: string,
    sale: SaleOrderDocument,
    userId: string,
    force = false
  ) {
    if (sale.linkedOrderId) {
      return;
    }
    if (!force && !sale.installationRequired && !sale.moveRequest) {
      return;
    }
    const materials = sale.items
      .filter((item) => item.inventoryItemId)
      .map((item) => ({
        itemId: item.inventoryItemId,
        qty: item.qty,
        itemName: item.name,
        description: 'Venda de produto'
      }));
    const billingItems = sale.items.map((item) => ({
      type: item.type === 'service' ? 'service' : 'part',
      name: item.name,
      qty: item.qty,
      unitPrice: item.unitPrice
    }));
    const orderDto: any = {
      clientId: sale.clientId,
      locationId: sale.locationId,
      equipmentId: sale.moveRequest?.equipmentId,
      costCenterId: sale.costCenterId,
      saleId: sale.id,
      materials,
      billingItems,
      billingDiscount: sale.totals.discount,
      notes: sale.notes
    };
    const order = await this.ordersService.create(tenantId, orderDto, userId);
    sale.linkedOrderId = order._id?.toString?.() ?? order._id;
    sale.status = 'in_progress';
    this.recordHistory(sale, 'in_progress', userId, `OS ${sale.linkedOrderId} criada`);
    await sale.save();
  }

  private recordHistory(sale: SaleOrderDocument, status: string, by?: string, note?: string) {
    sale.history = sale.history || [];
    sale.history.push({
      status,
      by,
      note,
      at: new Date()
    } as any);
  }
}
