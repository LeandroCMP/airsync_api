import { Injectable, NotFoundException, BadRequestException, Logger, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import { Order, OrderDocument, OrderBilling, BillingItem, OrderMaterial } from './order.schema';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { RescheduleOrderDto } from './dto/reschedule-order.dto';
import { InventoryService } from '../inventory/inventory.service';
import { OrderMaterialsDto } from './dto/order-materials.dto';
import { FilesService } from '../../core/files/files.service';
import { FinishOrderDto } from './dto/finish-order.dto';
import { PdfService } from '../../pdf/pdf.service';
import { executeWithTransactionIfSupported } from '../../common/utils/transaction.util';
import { EquipmentHistoryService } from '../equipment-history/equipment-history.service';
import { TenantService } from '../../core/tenancy/tenant.service';
import { OrderPaymentMethod } from './order.schema';
import { CreateOrderPurchaseDto } from './dto/create-order-purchase.dto';
import { PurchasesService } from '../purchases/purchases.service';
import { CreatePurchaseDto } from '../purchases/dto/create-purchase.dto';
import { FinanceService } from '../finance/finance.service';
import { MaintenanceService } from './maintenance.service';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    private readonly inventoryService: InventoryService,
    private readonly filesService: FilesService,
    private readonly financeService: FinanceService,
    private readonly pdfService: PdfService,
    private readonly equipmentHistory: EquipmentHistoryService,
    private readonly tenantService: TenantService,
    private readonly purchasesService: PurchasesService,
    private readonly maintenanceService: MaintenanceService
  ) {}

  private isManager(user: any) {
    return user?.role === 'owner' || user?.role === 'admin' || user?.role === 'manager';
  }

  private canAccessOrder(order: OrderDocument, user: any) {
    if (!user) {
      return false;
    }
    if (this.isManager(user)) {
      return true;
    }
    return Array.isArray(order?.technicianIds)
      ? order.technicianIds.some((techId) => String(techId) === String(user.id))
      : false;
  }

  ensureCanView(order: OrderDocument, user: any) {
    if (!this.canAccessOrder(order, user)) {
      throw new ForbiddenException({
        code: 'ORDER_FORBIDDEN',
        message: 'Voce nao tem permissao para ver esta OS.'
      });
    }
  }

  private refreshOrderCosts(order: OrderDocument) {
    const materialsCost = (order.materials || []).reduce((sum, mat: any) => {
      const qty = mat?.qty || 0;
      const unitCost = mat?.unitCost || 0;
      return sum + qty * unitCost;
    }, 0);
    const costs = order.costs || {};
    costs.materials = Number(materialsCost.toFixed(2));
    const labor = Number(costs.labor || 0);
    const overhead = Number(costs.overhead || 0);
    const purchases = Number(costs.purchases || 0);
    costs.total = Number((materialsCost + labor + overhead + purchases).toFixed(2));
    order.costs = costs;
    if (order.billing) {
      const revenue = order.billing.total || 0;
      order.costs.total = costs.total;
      order.margin = Number((revenue - costs.total).toFixed(2));
    }
  }

  private computeBilling(billingItems: BillingItem[] = [], discount = 0): OrderBilling {
    const subtotal = billingItems.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
    return {
      items: billingItems,
      subtotal,
      discount,
      total: Math.max(subtotal - discount, 0),
      status: 'pending'
    } as OrderBilling;
  }

  private computePaymentTotals(
    tenant: any,
    method: OrderPaymentMethod,
    amount: number,
    installments?: number
  ) {
    const normalizedAmount = amount || 0;
    let feePercent = 0;
    if (method === 'CARD_CREDIT') {
      const target = installments || 1;
      feePercent =
        tenant?.creditFees?.find((fee: any) => fee.installments === target)?.feePercent || 0;
    } else if (method === 'CARD_DEBIT') {
      feePercent = tenant?.debitFeePercent || 0;
    } else if (method === 'CHEQUE') {
      feePercent = tenant?.chequeFeePercent || 0;
    }
    const feeValue = Number(((normalizedAmount * feePercent) / 100).toFixed(2));
    const netAmount = Number((normalizedAmount - feeValue).toFixed(2));
    return { feePercent, feeValue, netAmount };
  }

  private async hydrateMaterialsMetadata(
    tenantId: string,
    materials: {
      itemId: string;
      qty: number;
      itemName?: string;
      description?: string;
      unitCost?: number;
    }[],
    session?: ClientSession | null
  ) {
    if (!materials?.length) {
      return [];
    }
    const cache = new Map<string, any>();
    const snapshots = [];
    for (const material of materials) {
      const snapshot = { ...material };
      if (!snapshot.itemName || snapshot.unitCost === undefined) {
        let inventory = cache.get(material.itemId);
        if (!inventory) {
          inventory = await this.inventoryService.findById(tenantId, material.itemId, session);
          cache.set(material.itemId, inventory);
        }
        if (!snapshot.itemName) {
          snapshot.itemName = inventory.name;
        }
        if (snapshot.unitCost === undefined) {
          snapshot.unitCost = inventory.avgCost ?? 0;
        }
      }
      snapshots.push(snapshot);
    }
    return snapshots;
  }

  private async loadOrderForUpdate(
    tenantId: string,
    id: string,
    session: ClientSession | null
  ): Promise<OrderDocument> {
    const query = this.orderModel.findOne({ tenantId, _id: id, deletedAt: null });
    if (session) {
      query.session(session);
    }
    const order = await query;
    if (!order) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'OS nao encontrada.' });
    }
    return order;
  }

  private async assertTechniciansAvailability(
    tenantId: string,
    scheduledAt: Date | undefined,
    technicianIds: string[] | undefined,
    excludeOrderId?: string,
    session?: ClientSession | null
  ) {
    if (!scheduledAt || !technicianIds?.length) return;
    const slotStart = new Date(Math.floor(scheduledAt.getTime() / 60000) * 60000);
    const slotEnd = new Date(slotStart.getTime() + 60000);
    const query: any = {
      tenantId,
      deletedAt: null,
      status: { $in: ['scheduled', 'in_progress'] },
      technicianIds: { $in: technicianIds },
      scheduledAt: { $gte: slotStart, $lt: slotEnd }
    };
    if (excludeOrderId) {
      query._id = { $ne: excludeOrderId };
    }
    const finder = this.orderModel.findOne(query);
    if (session) {
      finder.session(session);
    }
    const conflict = await finder.lean();
    if (conflict) {
      throw new BadRequestException({
        code: 'TECH_ALREADY_BOOKED',
        message: 'Tecnico ja possui OS neste horario.',
        details: { orderId: conflict._id?.toString?.(), technicianIds }
      });
    }
  }

  async create(tenantId: string, dto: CreateOrderDto, userId: string) {
    return executeWithTransactionIfSupported(this.orderModel.db, async (session) => {
      const materialSnapshots = await this.hydrateMaterialsMetadata(
        tenantId,
        dto.materials || [],
        session
      );
      const materials = materialSnapshots.map((m) => ({
        itemId: m.itemId,
        qty: m.qty,
        unitCost: m.unitCost,
        itemName: m.itemName,
        description: m.description,
        reserved: false
      }));
      const status = dto.status || 'scheduled';
      const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : new Date();

      const order = new this.orderModel({
        tenantId,
        clientId: dto.clientId,
        locationId: dto.locationId,
        equipmentId: dto.equipmentId,
        saleId: dto.saleId,
        status,
        scheduledAt,
        technicianIds: dto.technicianIds || [],
        checklist: (dto.checklist || []).map((c) => ({ item: c.item, done: false, photoUrls: [] })),
        materials,
        timesheet: {},
        photoUrls: [],
        notes: dto.notes,
        billing: this.computeBilling(dto.billingItems, dto.billingDiscount),
        audit: { createdBy: userId, updatedBy: userId }
      });

      if (materials.length) {
        await this.inventoryService.reserveForOrder(
          tenantId,
          order.id,
          materials.map((m) => ({ itemId: m.itemId, qty: m.qty })),
          userId,
          session || undefined
        );
        order.materials = order.materials.map((m) => ({ ...m, reserved: true }));
      }

      await this.assertTechniciansAvailability(
        tenantId,
        scheduledAt,
        order.technicianIds,
        undefined,
        session
      );
      await order.save(session ? { session } : undefined);

      if (dto.equipmentId) {
        await this.equipmentHistory.add(tenantId, {
          equipmentId: dto.equipmentId,
          orderId: order.id,
          type: 'order_created',
          at: scheduledAt,
          notes: dto.notes,
          by: userId
        });
      }
      return order.toObject();
    });
  }

  async findById(tenantId: string, id: string) {
    const order = await this.orderModel.findOne({ tenantId, _id: id, deletedAt: null });
    if (!order) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'OS nao encontrada.' });
    }
    return order;
  }

  async list(
    tenantId: string,
    filters: { status?: string; from?: string; to?: string; tech?: string },
    user: any
  ) {
    const query: any = { tenantId, deletedAt: null };
    const isManager = this.isManager(user);
    if (filters.status) query.status = filters.status;
    if (filters.from || filters.to) {
      query.scheduledAt = {};
      if (filters.from) query.scheduledAt.$gte = new Date(filters.from);
      if (filters.to) query.scheduledAt.$lte = new Date(filters.to);
    }
    if (isManager) {
      if (filters.tech) {
        query.technicianIds = filters.tech;
      }
    } else {
      query.technicianIds = user.id;
    }
    return this.orderModel.find(query).lean();
  }

  async listByEquipment(tenantId: string, equipmentId: string) {
    return this.orderModel
      .find({ tenantId, equipmentId, deletedAt: null })
      .sort({ scheduledAt: -1, createdAt: -1 })
      .lean();
  }

  async getCostSummary(tenantId: string, id: string, user: any) {
    const order = await this.findById(tenantId, id);
    this.ensureCanView(order, user);
    this.refreshOrderCosts(order);
    const costs = order.costs || {};
    const billingTotal = order.billing?.total || 0;
    const margin = Number((billingTotal - (costs.total || 0)).toFixed(2));
    return {
      orderId: order.id,
      billingTotal,
      costs,
      margin
    };
  }

  async update(tenantId: string, id: string, dto: UpdateOrderDto, userId: string) {
    const order = await this.findById(tenantId, id);
    if (dto.status) {
      order.status = dto.status;
      if (dto.status === 'canceled') {
        order.finishedAt = new Date();
        if (order.financeTransactionId) {
          await this.financeService.voidByRef(tenantId, `order:${order._id.toString()}`);
          order.financeTransactionId = undefined;
        }
      }
    }
    let nextDate = order.scheduledAt;
    if (dto.scheduledAt) {
      nextDate = new Date(dto.scheduledAt);
      if (Number.isNaN(nextDate.getTime())) {
        throw new BadRequestException({
          code: 'INVALID_SCHEDULE',
          message: 'scheduledAt must be a valid ISO 8601 date string'
        });
      }
    }
    const nextTechs = dto.technicianIds ?? order.technicianIds;
    await this.assertTechniciansAvailability(tenantId, nextDate, nextTechs, order._id.toString());
    if (nextDate) order.scheduledAt = nextDate;
    if (dto.technicianIds) order.technicianIds = dto.technicianIds;
    if (dto.checklist) order.checklist = dto.checklist as any;
    if (dto.billingItems) order.billing = this.computeBilling(dto.billingItems, dto.billingDiscount);
    if (dto.notes !== undefined) order.notes = dto.notes;
    order.audit.updatedBy = userId;
    await order.save();
    return order.toObject();
  }

  async reserveMaterials(tenantId: string, id: string, dto: OrderMaterialsDto, userId: string) {
    return executeWithTransactionIfSupported(this.orderModel.db, async (session) => {
      const order = await this.loadOrderForUpdate(tenantId, id, session);
      const hydratedMaterials = await this.hydrateMaterialsMetadata(
        tenantId,
        dto.materials || [],
        session
      );
      await this.inventoryService.reserveForOrder(
        tenantId,
        order.id,
        hydratedMaterials,
        userId,
        session || undefined
      );
      for (const mat of hydratedMaterials) {
        const existing = order.materials.find((m) => m.itemId === mat.itemId);
        if (existing) {
          existing.qty += mat.qty;
          existing.reserved = true;
          if (mat.itemName) {
            existing.itemName = mat.itemName;
          }
          if (mat.description) {
            existing.description = mat.description;
          }
          if (mat.unitCost !== undefined) {
            existing.unitCost = mat.unitCost;
          }
        } else {
          order.materials.push({
            itemId: mat.itemId,
            qty: mat.qty,
            itemName: mat.itemName,
            description: mat.description,
            unitCost: mat.unitCost,
            reserved: true
          });
        }
      }
      order.audit.updatedBy = userId;
      await order.save(session ? { session } : undefined);
      return order.toObject();
    });
  }

  async deductMaterials(tenantId: string, id: string, dto: OrderMaterialsDto, userId: string) {
    return executeWithTransactionIfSupported(this.orderModel.db, async (session) => {
      const order = await this.loadOrderForUpdate(tenantId, id, session);
      await this.inventoryService.deductForOrder(
        tenantId,
        order.id,
        dto.materials,
        userId,
        session || undefined
      );
      for (const mat of dto.materials) {
        const existing = order.materials.find((m) => m.itemId === mat.itemId);
        if (existing) {
          existing.reserved = false;
          existing.deductedAt = new Date();
        }
      }
      this.refreshOrderCosts(order);
      order.audit.updatedBy = userId;
      await order.save(session ? { session } : undefined);
      return order.toObject();
    });
  }

  async createPurchaseFromOrder(
    tenantId: string,
    id: string,
    dto: CreateOrderPurchaseDto,
    userId: string
  ) {
    const order = await this.findById(tenantId, id);
    const baseItems =
      dto.items && dto.items.length
        ? dto.items.map((item) => ({
            itemId: item.itemId,
            qty: item.qty,
            unitCost: item.unitCost
          }))
        : (order.materials || []).map((material) => ({
            itemId: material.itemId,
            qty: material.qty,
            unitCost: material.unitCost
          }));

    const prepared = baseItems.filter((item) => (item.qty || 0) > 0);
    if (!prepared.length) {
      throw new BadRequestException({
        code: 'ORDER_PURCHASE_NO_ITEMS',
        message: 'Nenhum item disponível para gerar compra a partir desta OS'
      });
    }

    const indexesToHydrate = prepared
      .map((item, index) =>
        item.unitCost === undefined || item.unitCost === null ? index : -1
      )
      .filter((index) => index >= 0);
    if (indexesToHydrate.length) {
      const payload = indexesToHydrate.map((idx) => ({
        itemId: prepared[idx].itemId,
        qty: prepared[idx].qty,
        unitCost: prepared[idx].unitCost
      }));
      const hydrated = await this.hydrateMaterialsMetadata(tenantId, payload);
      indexesToHydrate.forEach((targetIdx, arrayIdx) => {
        prepared[targetIdx].unitCost = hydrated[arrayIdx].unitCost ?? 0;
      });
    }

    const purchaseItems = prepared.map((item) => ({
      itemId: item.itemId,
      qty: item.qty,
      unitCost: Number((item.unitCost ?? 0).toFixed(2)),
      orderId: String(order.id)
    }));

    const computedSubtotal = purchaseItems.reduce(
      (sum, item) => sum + item.qty * item.unitCost,
      0
    );
    const subtotal =
      dto.subtotal !== undefined && dto.subtotal !== null ? dto.subtotal : computedSubtotal;
    const normalizedSubtotal = Number(Number(subtotal).toFixed(2));

    const paymentDueDate = dto.paymentDueDate ? new Date(dto.paymentDueDate) : undefined;
    if (paymentDueDate && Number.isNaN(paymentDueDate.getTime())) {
      throw new BadRequestException({
        code: 'PURCHASE_INVALID_DUE_DATE',
        message: 'paymentDueDate inválido'
      });
    }

    const payload: CreatePurchaseDto = {
      supplierId: dto.supplierId,
      status: dto.status || 'draft',
      items: purchaseItems,
      freight: dto.freight,
      paymentDueDate,
      subtotal: normalizedSubtotal,
      notes: dto.notes
    };

    return this.purchasesService.create(tenantId, payload, userId);
  }

  async startOrder(tenantId: string, id: string, userId: string) {
    const order = await this.findById(tenantId, id);
    order.status = 'in_progress';
    order.startedAt = new Date();
    order.timesheet.start = new Date();
    order.audit.updatedBy = userId;
    await order.save();
    return order.toObject();
  }

  async finishOrder(tenantId: string, id: string, dto: FinishOrderDto, userId: string) {
    return executeWithTransactionIfSupported(this.orderModel.db, async (session) => {
      const order = await this.loadOrderForUpdate(tenantId, id, session);
      if (order.status === 'done') {
        throw new BadRequestException({ code: 'ORDER_ALREADY_FINISHED', message: 'OS ja foi finalizada.' });
      }

      if (order.checklist && order.checklist.length) {
        const pending = order.checklist.filter((item) => !item.done);
        if (pending.length) {
          throw new BadRequestException({
            code: 'CHECKLIST_INCOMPLETE',
            message: 'Checklist must be completed before finishing the order',
            details: pending.map((item) => item.item)
          });
        }
      }

      if (!order.customerSignatureUrl && !dto.signatureBase64) {
        throw new BadRequestException({
          code: 'SIGNATURE_REQUIRED',
          message: 'Customer signature is required to close the order'
        });
      }

      if (!dto.payments || !dto.payments.length) {
        this.logger.warn(
          `finishOrder called without payments`,
          JSON.stringify({
            orderId: id,
            tenantId,
            hasPayments: !!dto.payments,
            paymentsLength: dto.payments?.length || 0
          })
        );
        throw new BadRequestException({
          code: 'PAYMENTS_REQUIRED',
          message: 'At least one payment is required to close the order'
        });
      }

      const tenant = await this.tenantService.findById(tenantId);
      const payments = dto.payments.map((payment) => {
        if (payment.amount === undefined || payment.amount < 0) {
          throw new BadRequestException({
            code: 'INVALID_PAYMENT_AMOUNT',
            message: 'Payment amount must be greater than or equal to 0'
          });
        }
        const totals = this.computePaymentTotals(
          tenant,
          payment.method,
          payment.amount,
          payment.installments
        );
        return {
          method: payment.method,
          amount: payment.amount,
          installments: payment.installments,
          feePercent: totals.feePercent,
          feeValue: totals.feeValue,
          netAmount: totals.netAmount
        };
      });

      const paymentSum = payments.reduce((sum, payment) => sum + payment.amount, 0);
      let billingSnapshot = order.billing;
      if (dto.billingItems) {
        billingSnapshot = this.computeBilling(dto.billingItems, dto.discount);
      } else if (dto.discount !== undefined && order.billing) {
        billingSnapshot = this.computeBilling(order.billing.items || [], dto.discount);
      }
      const orderTotal = billingSnapshot?.total ?? 0;
      if (Math.abs(paymentSum - orderTotal) > 0.01) {
        throw new BadRequestException({
          code: 'PAYMENT_MISMATCH',
          message: 'Sum of payments must match billing total'
        });
      }

      const materialsToDeduct = order.materials.filter((m) => m.reserved);
      if (materialsToDeduct.length) {
        await this.inventoryService.deductForOrder(
          tenantId,
          order.id,
          materialsToDeduct.map((m) => ({ itemId: m.itemId, qty: m.qty })),
          userId,
          session || undefined
        );
        order.materials = order.materials.map((m) =>
          m.reserved
            ? {
                ...m,
                reserved: false,
                deductedAt: new Date()
              }
            : m
        );
      }

      if (billingSnapshot) {
        order.billing = billingSnapshot;
      }
      if (dto.notes !== undefined) {
        order.notes = dto.notes;
      }
      if (dto.signatureBase64) {
        const signatureUrl = await this.filesService.saveBase64(dto.signatureBase64, 'png');
        order.customerSignatureUrl = signatureUrl;
      }
      order.payments = payments as any;
      order.paymentGrossTotal = paymentSum;
      order.paymentFeeTotal = payments.reduce((sum, payment) => sum + payment.feeValue, 0);
      order.paymentNetTotal = payments.reduce((sum, payment) => sum + payment.netAmount, 0);
      if (order.billing) {
        order.billing.status = 'paid';
      }
      this.refreshOrderCosts(order);
      order.status = 'done';
      order.finishedAt = new Date();
      order.timesheet.end = new Date();
      if (order.timesheet.start) {
        order.timesheet.totalMin = Math.round(
          (order.timesheet.end.getTime() - new Date(order.timesheet.start).getTime()) / 60000
        );
      }
      order.audit.updatedBy = userId;
    await order.save(session ? { session } : undefined);

    let financeTx: any = null;
    if (order.billing.total > 0) {
      financeTx = await this.financeService.create(
        tenantId,
        {
          type: 'receivable',
          ref: `order:${order.id}`,
          partyId: order.clientId,
          category: 'service',
          description: `OS ${order.id}`,
          dueDate: new Date(),
          amount: order.billing.total
        },
        userId,
        session || undefined
      );
      order.financeTransactionId = financeTx._id?.toString?.() ?? financeTx._id;
      for (const payment of payments) {
        await this.financeService.pay(
          tenantId,
          order.financeTransactionId,
          {
            method: payment.method as any,
            amount: payment.amount
          },
          userId
        );
      }
    }

      if (order.equipmentId) {
        await this.equipmentHistory.add(tenantId, {
          equipmentId: order.equipmentId,
          orderId: order.id,
          type: 'order_finished',
          at: order.finishedAt,
          notes: dto.notes,
          by: userId
        });
      }
      await this.maintenanceService.upsertRemindersFromOrder(order);
      return order.toObject();
    });
  }

  async addPhoto(tenantId: string, id: string, file: Express.Multer.File, userId: string) {
    const order = await this.findById(tenantId, id);
    const ext = file.originalname.split('.').pop() || 'jpg';
    const url = await this.filesService.saveBuffer(file.buffer, ext);
    order.photoUrls.push(url);
    order.audit.updatedBy = userId;
    await order.save();
    return { url };
  }

  async addSignature(tenantId: string, id: string, base64: string, userId: string) {
    const order = await this.findById(tenantId, id);
    const url = await this.filesService.saveBase64(base64, 'png');
    order.customerSignatureUrl = url;
    order.audit.updatedBy = userId;
    await order.save();
    return { url };
  }

  async generatePdf(tenantId: string, id: string, type: 'report' | 'budget' | 'warranty') {
    const order = await this.findById(tenantId, id);
    return this.pdfService.generateOrderPdf(order.toObject(), type);
  }

  async reschedule(
    tenantId: string,
    id: string,
    dto: RescheduleOrderDto,
    userId: string
  ) {
    const order = await this.findById(tenantId, id);
    const nextDate = new Date(dto.scheduledAt);
    if (Number.isNaN(nextDate.getTime())) {
      throw new BadRequestException({
        code: 'INVALID_SCHEDULE',
        message: 'scheduledAt must be a valid ISO 8601 date string'
      });
    }
    await this.assertTechniciansAvailability(
      tenantId,
      nextDate,
      order.technicianIds,
      order._id.toString()
    );
    order.scheduledAt = nextDate;
    if (dto.notes !== undefined) {
      order.notes = dto.notes;
    }
    if (order.status !== 'done') {
      order.status = 'scheduled';
    }
    order.audit.updatedBy = userId;
    await order.save();

    if (order.equipmentId) {
      await this.equipmentHistory.add(tenantId, {
        equipmentId: order.equipmentId,
        orderId: order.id,
        type: 'order_rescheduled',
        at: nextDate,
        notes: dto.notes,
        by: userId
      });
    }

    return order.toObject();
  }
}
