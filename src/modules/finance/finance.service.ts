import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FinanceTransaction, FinanceTransactionDocument } from './finance-transaction.schema';
import { Order, OrderDocument } from '../orders/order.schema';
import { Purchase, PurchaseDocument } from '../purchases/purchase.schema';
import { CreateFinanceTransactionDto } from './dto/create-transaction.dto';
import { PayTransactionDto } from './dto/pay-transaction.dto';
import { AllocateIndirectCostsDto } from './dto/allocate-indirect-costs.dto';

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);

  constructor(
    @InjectModel(FinanceTransaction.name)
    private readonly financeModel: Model<FinanceTransactionDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Purchase.name)
    private readonly purchaseModel: Model<PurchaseDocument>
  ) {}

  private normalizeAmount(value: number) {
    return Number(Number(value || 0).toFixed(2));
  }

  async create(tenantId: string, dto: CreateFinanceTransactionDto, userId: string, session?: any) {
    const amount = this.normalizeAmount(dto.amount);
    if (amount <= 0) {
      throw new BadRequestException({ code: 'INVALID_AMOUNT', message: 'Informe um valor maior que zero.' });
    }
    try {
      const transaction = await this.financeModel.create(
        [
          {
            tenantId,
            type: dto.type,
            ref: dto.ref,
            partyId: dto.partyId,
            category: dto.category,
            description: dto.description,
            dueDate: dto.dueDate,
            amount,
            currency: (dto as any).currency || 'BRL',
            installments: dto.installments,
            payments: [],
            updatedBy: userId
          }
        ],
        { session }
      );
      this.logger.log(`Transação criada | tenant=${tenantId} ref=${dto.ref} tipo=${dto.type} valor=${amount}`);
      return transaction[0].toObject();
    } catch (err: any) {
      if (err && err.code === 11000) {
      throw new BadRequestException({ code: 'DUPLICATE_REF', message: 'Ja existe um lancamento para este identificador.' });
      }
      throw err;
    }
  }

  async findById(tenantId: string, id: string) {
    const tx = await this.financeModel.findOne({ tenantId, _id: id });
    if (!tx) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Lancamento financeiro nao encontrado.' });
    }
    return tx;
  }

  async list(
    tenantId: string,
    filters: { type?: string; paid?: string; from?: string; to?: string; page?: number; limit?: number }
  ) {
    const query: any = { tenantId };
    if (filters.type) query.type = filters.type;
    if (filters.paid !== undefined) query.paid = filters.paid === 'true';
    if (filters.from || filters.to) {
      query.dueDate = {};
      if (filters.from) query.dueDate.$gte = new Date(filters.from);
      if (filters.to) query.dueDate.$lte = new Date(filters.to);
    }
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.financeModel.find(query).skip(skip).limit(limit).lean(),
      this.financeModel.countDocuments(query)
    ]);
    return { items, page, limit, total };
  }

  async findByRef(tenantId: string, ref: string) {
    return this.financeModel.findOne({ tenantId, ref });
  }

  async voidByRef(tenantId: string, ref: string) {
    await this.financeModel.deleteOne({ tenantId, ref });
    this.logger.log(`Transação anulada | tenant=${tenantId} ref=${ref}`);
  }

  async remove(tenantId: string, id: string, session?: any) {
    const query = this.financeModel.deleteOne({ tenantId, _id: id });
    if (session) {
      query.session(session);
    }
    await query;
  }

  async pay(tenantId: string, id: string, dto: PayTransactionDto, userId: string) {
    const tx = await this.findById(tenantId, id);
    if (tx.paid) {
      throw new BadRequestException({ code: 'ALREADY_PAID', message: 'Este lancamento ja foi quitado.' });
    }
    const payment = {
      method: dto.method,
      amount: 0,
      txid: dto.txid,
      idempotencyKey: dto.idempotencyKey,
      at: new Date()
    };
    // Idempotência: se já existe pagamento com mesmo txid ou idempotencyKey, retorna sem duplicar
    const dup = tx.payments.find(
      (p: any) => (dto.txid && p.txid === dto.txid) || (dto.idempotencyKey && p.idempotencyKey === dto.idempotencyKey)
    );
    if (dup) {
      this.logger.warn(`Pagamento ignorado (idempotente) | tenant=${tenantId} ref=${tx.ref}`);
      return tx.toObject();
    }
    const resolveRemaining = () => {
      if (dto.installmentNumber !== undefined && tx.installments?.length) {
        const installment = tx.installments.find((i) => i.number === dto.installmentNumber);
        if (!installment) {
          throw new BadRequestException({ code: 'INSTALLMENT_NOT_FOUND', message: 'Parcela nao encontrada.' });
        }
        const paidAmount = installment.payments.reduce((sum, p) => sum + p.amount, 0);
        return this.normalizeAmount(installment.amount - paidAmount);
      }
      const paidAmount = tx.payments.reduce((sum, p) => sum + p.amount, 0);
      return this.normalizeAmount(tx.amount - paidAmount);
    };

    const payAmount = dto.amount !== undefined ? this.normalizeAmount(dto.amount) : resolveRemaining();
    if (payAmount <= 0) {
      throw new BadRequestException({ code: 'INVALID_AMOUNT', message: 'Valor invalido ou saldo ja quitado.' });
    }
    payment.amount = payAmount;

    if (dto.installmentNumber !== undefined && tx.installments?.length) {
      const installment = tx.installments.find((i) => i.number === dto.installmentNumber);
      if (!installment) {
        throw new BadRequestException({ code: 'INSTALLMENT_NOT_FOUND', message: 'Parcela nao encontrada.' });
      }
      const paidAmount = installment.payments.reduce((sum, p) => sum + p.amount, 0);
      const remaining = installment.amount - paidAmount;
      if (payAmount > remaining + 0.01) {
        throw new BadRequestException({ code: 'OVERPAY', message: 'Valor maior que o saldo desta parcela.' });
      }
      installment.payments.push(payment as any);
      const newPaidAmount = installment.payments.reduce((sum, p) => sum + p.amount, 0);
      installment.paid = newPaidAmount >= installment.amount - 0.01;
    } else {
      const paidAmount = tx.payments.reduce((sum, p) => sum + p.amount, 0);
      const remaining = tx.amount - paidAmount;
      if (payAmount > remaining + 0.01) {
        throw new BadRequestException({ code: 'OVERPAY', message: 'Valor maior que o saldo em aberto.' });
      }
      tx.payments.push(payment as any);
    }
    const totalPaid = (
      tx.payments.reduce((sum, p) => sum + p.amount, 0) +
      (tx.installments?.reduce((sum, inst) => sum + inst.payments.reduce((s, p) => s + p.amount, 0), 0) || 0)
    );
    if (totalPaid >= tx.amount - 0.01) {
      tx.paid = true;
    }
    tx.updatedBy = userId;
    await tx.save();
    this.logger.log(`Pagamento registrado | tenant=${tenantId} ref=${tx.ref} valor=${payAmount} metodo=${dto.method}`);
    return tx.toObject();
  }

  async dashboard(tenantId: string, month?: string) {
    const { start, end } = this.resolveMonthRange(month);
    const orderQuery: any = {
      tenantId,
      status: 'done',
      finishedAt: { $gte: start, $lte: end }
    };
    const orders = await this.orderModel.find(orderQuery).lean();

    const orderCount = orders.length;
    const revenueTotal = orders.reduce(
      (sum, order: any) => sum + (order?.billing?.total || 0),
      0
    );
    const materialCostTotal = orders.reduce((sum, order: any) => {
      const materials = Array.isArray(order?.materials) ? order.materials : [];
      const materialCost = materials.reduce(
        (acc: number, mat: any) => acc + (mat?.qty || 0) * (mat?.unitCost || 0),
        0
      );
      return sum + materialCost;
    }, 0);
    const grossCollected = orders.reduce(
      (sum, order: any) => sum + (order?.paymentGrossTotal || 0),
      0
    );
    const netCollected = orders.reduce(
      (sum, order: any) => sum + (order?.paymentNetTotal || 0),
      0
    );

    const paymentBuckets = new Map<
      string,
      { method: string; gross: number; fees: number; net: number }
    >();
    for (const order of orders) {
      const payments = Array.isArray(order?.payments) ? order.payments : [];
      for (const payment of payments) {
        const method = payment?.method || 'UNKNOWN';
        if (!paymentBuckets.has(method)) {
          paymentBuckets.set(method, { method, gross: 0, fees: 0, net: 0 });
        }
        const bucket = paymentBuckets.get(method)!;
        bucket.gross += payment?.amount || 0;
        bucket.fees += payment?.feeValue || 0;
        bucket.net += payment?.netAmount || payment?.amount || 0;
      }
    }
    const paymentsByMethod = Array.from(paymentBuckets.values())
      .map((bucket) => ({
        method: bucket.method,
        gross: this.normalizeCurrency(bucket.gross),
        fees: this.normalizeCurrency(bucket.fees),
        net: this.normalizeCurrency(bucket.net)
      }))
      .sort((a, b) => b.gross - a.gross);

    const receivableTxs = await this.financeModel
      .find({ tenantId, type: 'receivable', paid: false })
      .lean();
    const payableTxs = await this.financeModel
      .find({ tenantId, type: 'payable', paid: false })
      .lean();

    const purchases = await this.purchaseModel.find({ tenantId, deletedAt: null }).lean();
    const purchaseApprovalStats = purchases.reduce(
      (acc, purchase: any) => {
        if (purchase.status === 'pending') acc.pending += 1;
        else if (purchase.status === 'approved') acc.approved += 1;
        else if (purchase.status === 'ordered') acc.ordered += 1;
        else if (purchase.status === 'received') acc.received += 1;
        return acc;
      },
      { pending: 0, approved: 0, ordered: 0, received: 0 }
    );
    const openPurchases = purchases.filter(
      (purchase: any) =>
        purchase.status === 'draft' || purchase.status === 'pending' || purchase.status === 'approved'
    );
    const purchasesSummary = {
      open: openPurchases.length,
      openValue: this.normalizeCurrency(
        openPurchases.reduce((sum, purchase: any) => sum + (purchase?.totals?.total || 0), 0)
      ),
      received: purchases.filter((purchase: any) => purchase.status === 'received').length,
      canceled: purchases.filter((purchase: any) => purchase.status === 'canceled').length
    };

    const cards = {
      month: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
      ordersDone: orderCount,
      revenue: this.normalizeCurrency(revenueTotal),
      avgTicket: orderCount ? this.normalizeCurrency(revenueTotal / orderCount) : 0,
      grossCollected: this.normalizeCurrency(grossCollected),
      netCollected: this.normalizeCurrency(netCollected),
      materialCost: this.normalizeCurrency(materialCostTotal),
      purchaseCost: this.normalizeCurrency(
        purchases
          .filter((purchase: any) => purchase.status === 'ordered' || purchase.status === 'received')
          .reduce((sum, purchase: any) => sum + (purchase?.totals?.total || 0), 0)
      ),
      margin: this.normalizeCurrency(
        revenueTotal - (materialCostTotal +
          purchases
            .filter((purchase: any) => purchase.status === 'ordered' || purchase.status === 'received')
            .reduce((sum, purchase: any) => sum + (purchase?.totals?.total || 0), 0))
      )
    };

    return {
      period: {
        from: start.toISOString(),
        to: end.toISOString()
      },
      cards,
      paymentsByMethod,
      receivables: this.summarizeCashflow(receivableTxs),
      payables: this.summarizeCashflow(payableTxs),
      purchases: purchasesSummary,
      purchaseApprovals: purchaseApprovalStats
    };
  }

  async audit(tenantId: string) {
    const orders = await this.orderModel.find({ tenantId, deletedAt: null }).lean();
    const purchases = await this.purchaseModel.find({ tenantId, deletedAt: null }).lean();
    const audit = { orders: [], purchases: [] } as {
      orders: any[];
      purchases: any[];
    };

    for (const order of orders) {
      const billingTotal = Number(order?.billing?.total || 0);
      const paymentSum = Array.isArray(order?.payments)
        ? order.payments.reduce((sum: number, payment: any) => sum + (payment?.amount || 0), 0)
        : 0;
      if (Math.abs(paymentSum - billingTotal) > 0.01) {
        audit.orders.push({
          orderId: order._id,
          issue: 'payment_sum_mismatch',
          billingTotal,
          paymentSum
        });
      }
      if (order.financeTransactionId) {
        const tx = await this.financeModel.findOne({
          tenantId,
          _id: order.financeTransactionId
        });
        if (!tx) {
          audit.orders.push({
            orderId: order._id,
            issue: 'finance_tx_missing',
            financeTransactionId: order.financeTransactionId
          });
        } else {
          if (Math.abs((tx.amount || 0) - billingTotal) > 0.01) {
            audit.orders.push({
              orderId: order._id,
              issue: 'finance_amount_mismatch',
              billingTotal,
              financeAmount: tx.amount
            });
          }
          const orderPaid = order?.billing?.status === 'paid';
          if (orderPaid !== tx.paid) {
            audit.orders.push({
              orderId: order._id,
              issue: 'finance_paid_flag_mismatch',
              orderPaid,
              financePaid: tx.paid
            });
          }
        }
      }
    }

    for (const purchase of purchases) {
      const total = Number(purchase?.totals?.total || 0);
      const shouldHaveFinance =
        total > 0 && purchase.status !== 'canceled' && purchase.status !== 'draft';
      if (shouldHaveFinance && !purchase.financeTransactionId) {
        audit.purchases.push({
          purchaseId: purchase._id,
          issue: 'finance_tx_missing',
          total
        });
        continue;
      }
      if (purchase.financeTransactionId) {
        const tx = await this.financeModel.findOne({
          tenantId,
          _id: purchase.financeTransactionId
        });
        if (!tx) {
          audit.purchases.push({
            purchaseId: purchase._id,
            issue: 'finance_tx_missing',
            financeTransactionId: purchase.financeTransactionId
          });
        } else if (Math.abs((tx.amount || 0) - total) > 0.01) {
          audit.purchases.push({
            purchaseId: purchase._id,
            issue: 'finance_amount_mismatch',
            purchaseTotal: total,
            financeAmount: tx.amount
          });
        }
      }
    }

    return audit;
  }

  async forecast(tenantId: string, days = 30) {
    const horizon = Math.max(1, Number(days) || 30);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const timeline = [];
    const buckets = new Map<
      string,
      {
        date: string;
        receivables: number;
        payables: number;
        projectedOrders: number;
        projectedPurchases: number;
      }
    >();
    for (let i = 0; i < horizon; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const key = date.toISOString().slice(0, 10);
      const bucket = {
        date: key,
        receivables: 0,
        payables: 0,
        projectedOrders: 0,
        projectedPurchases: 0
      };
      buckets.set(key, bucket);
      timeline.push(bucket);
    }
    const end = new Date(start);
    end.setDate(start.getDate() + horizon);

    const txs = await this.financeModel
      .find({
        tenantId,
        paid: false,
        dueDate: { $gte: start, $lt: end }
      })
      .lean();
    for (const tx of txs) {
      const key = new Date(tx.dueDate).toISOString().slice(0, 10);
      const bucket = buckets.get(key);
      if (!bucket) continue;
      if (tx.type === 'receivable') {
        bucket.receivables += tx.amount || 0;
      } else {
        bucket.payables += tx.amount || 0;
      }
    }

    const scheduledOrders = await this.orderModel
      .find({
        tenantId,
        status: { $in: ['scheduled', 'in_progress'] },
        scheduledAt: { $gte: start, $lt: end }
      })
      .lean();
    for (const order of scheduledOrders) {
      const key = new Date(order.scheduledAt).toISOString().slice(0, 10);
      const bucket = buckets.get(key);
      if (!bucket) continue;
      bucket.projectedOrders += order?.billing?.total || 0;
    }

    const pendingPurchases = await this.purchaseModel
      .find({
        tenantId,
        status: { $in: ['ordered'] },
        paymentDueDate: { $gte: start, $lt: end }
      })
      .lean();
    for (const purchase of pendingPurchases) {
      const key = new Date(purchase.paymentDueDate).toISOString().slice(0, 10);
      const bucket = buckets.get(key);
      if (!bucket) continue;
      bucket.projectedPurchases += purchase?.totals?.total || 0;
    }

    const timelineWithNet = timeline.map((bucket) => ({
      ...bucket,
      net:
        bucket.receivables +
        bucket.projectedOrders -
        bucket.payables -
        bucket.projectedPurchases
    }));

    return {
      from: start.toISOString(),
      to: end.toISOString(),
      days: horizon,
      timeline: timelineWithNet
    };
  }

  async allocateIndirectCosts(tenantId: string, dto: AllocateIndirectCostsDto) {
    const start = new Date(dto.from);
    const end = new Date(dto.to);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException({
        code: 'INVALID_PERIOD',
        message: 'Datas invalidas. Use formato ISO (AAAA-MM-DD).'
      });
    }
    if (end < start) {
      throw new BadRequestException({
        code: 'INVALID_PERIOD',
        message: 'Data final deve ser maior que a inicial.'
      });
    }
    const categories =
      dto.categories && dto.categories.length
        ? dto.categories
        : ['fleet_fuel', 'fleet_maintenance', 'payroll'];
    const orders = await this.orderModel
      .find({
        tenantId,
        status: 'done',
        finishedAt: { $gte: start, $lte: end }
      })
      .lean();
    const totalBilling = orders.reduce(
      (sum, order: any) => sum + (order?.billing?.total || 0),
      0
    );
    if (!totalBilling) {
      return { totalIndirect: 0, affectedOrders: 0 };
    }
    const indirectTxs = await this.financeModel
      .find({
        tenantId,
        type: 'payable',
        category: { $in: categories },
        dueDate: { $gte: start, $lte: end }
      })
      .lean();
    const totalIndirect = indirectTxs.reduce(
      (sum, tx: any) => sum + (tx?.amount || 0),
      0
    );
    if (!totalIndirect) {
      return { totalIndirect: 0, affectedOrders: 0 };
    }
    let affected = 0;
    for (const orderData of orders) {
      const billing = orderData?.billing?.total || 0;
      if (billing <= 0) continue;
      const share = Number(((billing / totalBilling) * totalIndirect).toFixed(2));
      if (!share) continue;
      const order = await this.orderModel.findOne({ tenantId, _id: orderData._id, deletedAt: null });
      if (!order) continue;
      const costs = order.costs || {};
      costs.overhead = Number(((costs.overhead || 0) + share).toFixed(2));
      const materials = Number(costs.materials || 0);
      const labor = Number(costs.labor || 0);
      const purchases = Number(costs.purchases || 0);
      costs.total = Number((materials + labor + purchases + costs.overhead).toFixed(2));
      order.costs = costs;
      await order.save();
      affected += 1;
    }
    return { totalIndirect: Number(totalIndirect.toFixed(2)), affectedOrders: affected };
  }

  private resolveMonthRange(month?: string) {
    const now = new Date();
    let year = now.getFullYear();
    let monthIndex = now.getMonth();
    if (month) {
      const [yearStr, monthStr] = month.split('-');
      const parsedYear = Number(yearStr);
      const parsedMonth = Number(monthStr) - 1;
      if (!Number.isNaN(parsedYear) && !Number.isNaN(parsedMonth) && parsedMonth >= 0 && parsedMonth < 12) {
        year = parsedYear;
        monthIndex = parsedMonth;
      }
    }
    const start = new Date(year, monthIndex, 1);
    const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }

  private summarizeCashflow(transactions: any[]) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const summary = { pending: 0, overdue: 0, upcoming: 0 };
    for (const tx of transactions) {
      const outstanding = this.calculateOutstandingAmount(tx);
      if (outstanding <= 0) {
        continue;
      }
      summary.pending += outstanding;
      const dueDate = tx.dueDate ? new Date(tx.dueDate) : today;
      if (dueDate < today) {
        summary.overdue += outstanding;
      } else {
        summary.upcoming += outstanding;
      }
    }
    return {
      pending: this.normalizeCurrency(summary.pending),
      overdue: this.normalizeCurrency(summary.overdue),
      upcoming: this.normalizeCurrency(summary.upcoming)
    };
  }

  private calculateOutstandingAmount(tx: any) {
    const directPayments = Array.isArray(tx?.payments)
      ? tx.payments.reduce((sum: number, payment: any) => sum + (payment?.amount || 0), 0)
      : 0;
    const installmentsPayments = Array.isArray(tx?.installments)
      ? tx.installments.reduce((sum: number, installment: any) => {
          const installmentPaid = Array.isArray(installment?.payments)
            ? installment.payments.reduce((acc: number, payment: any) => acc + (payment?.amount || 0), 0)
            : 0;
          return sum + installmentPaid;
        }, 0)
      : 0;
    const outstanding = (tx?.amount || 0) - directPayments - installmentsPayments;
    return outstanding > 0 ? outstanding : 0;
  }

  private normalizeCurrency(value: number) {
    const safe = typeof value === 'number' && !Number.isNaN(value) ? value : 0;
    return Number(safe.toFixed(2));
  }
}
