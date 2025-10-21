import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import { Order, OrderDocument } from './order.schema';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { InventoryService } from '../inventory/inventory.service';
import { OrderMaterialsDto } from './dto/order-materials.dto';
import { FilesService } from '../../core/files/files.service';
import { FinishOrderDto } from './dto/finish-order.dto';
import { FinanceService } from '../finance/finance.service';
import { PdfService } from '../../pdf/pdf.service';
import { executeWithTransactionIfSupported } from '../../common/utils/transaction.util';

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    private readonly inventoryService: InventoryService,
    private readonly filesService: FilesService,
    private readonly financeService: FinanceService,
    private readonly pdfService: PdfService
  ) {}

  private computeBilling(billingItems?: any[], discount = 0) {
    const subtotal = (billingItems || []).reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
    return {
      items: billingItems || [],
      subtotal,
      discount,
      total: Math.max(subtotal - discount, 0),
      status: 'pending'
    };
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
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Order not found' });
    }
    return order;
  }

  async create(tenantId: string, dto: CreateOrderDto, userId: string) {
    return executeWithTransactionIfSupported(this.orderModel.db, async (session) => {
      const materials = (dto.materials || []).map((m) => ({
        itemId: m.itemId,
        qty: m.qty,
        reserved: false
      }));

      const order = new this.orderModel({
        tenantId,
        clientId: dto.clientId,
        locationId: dto.locationId,
        equipmentId: dto.equipmentId,
        status: dto.status || 'scheduled',
        scheduledAt: dto.scheduledAt,
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

      await order.save(session ? { session } : undefined);
      return order.toObject();
    });
  }

  async findById(tenantId: string, id: string) {
    const order = await this.orderModel.findOne({ tenantId, _id: id, deletedAt: null });
    if (!order) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Order not found' });
    }
    return order;
  }

  async list(
    tenantId: string,
    filters: { status?: string; from?: string; to?: string; tech?: string }
  ) {
    const query: any = { tenantId, deletedAt: null };
    if (filters.status) query.status = filters.status;
    if (filters.from || filters.to) {
      query.scheduledAt = {};
      if (filters.from) query.scheduledAt.$gte = new Date(filters.from);
      if (filters.to) query.scheduledAt.$lte = new Date(filters.to);
    }
    if (filters.tech) {
      query.technicianIds = filters.tech;
    }
    return this.orderModel.find(query).lean();
  }

  async update(tenantId: string, id: string, dto: UpdateOrderDto, userId: string) {
    const order = await this.findById(tenantId, id);
    if (dto.status) order.status = dto.status;
    if (dto.scheduledAt) order.scheduledAt = dto.scheduledAt as any;
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
      await this.inventoryService.reserveForOrder(
        tenantId,
        order.id,
        dto.materials,
        userId,
        session || undefined
      );
      for (const mat of dto.materials) {
        const existing = order.materials.find((m) => m.itemId === mat.itemId);
        if (existing) {
          existing.qty += mat.qty;
          existing.reserved = true;
        } else {
          order.materials.push({ itemId: mat.itemId, qty: mat.qty, reserved: true });
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
      order.audit.updatedBy = userId;
      await order.save(session ? { session } : undefined);
      return order.toObject();
    });
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
        throw new BadRequestException({ code: 'ORDER_ALREADY_FINISHED', message: 'Order already finished' });
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

      if (dto.billingItems) {
        order.billing = this.computeBilling(dto.billingItems, dto.discount);
      }
      if (dto.notes !== undefined) {
        order.notes = dto.notes;
      }
      if (dto.signatureBase64) {
        const signatureUrl = await this.filesService.saveBase64(dto.signatureBase64, 'png');
        order.customerSignatureUrl = signatureUrl;
      }
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

      if (order.billing.total > 0) {
        await this.financeService.create(
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
      }

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
}
