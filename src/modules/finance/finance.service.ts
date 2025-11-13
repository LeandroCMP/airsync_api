import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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
  constructor(
    @InjectModel(FinanceTransaction.name)
    private readonly financeModel: Model<FinanceTransactionDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Purchase.name)
    private readonly purchaseModel: Model<PurchaseDocument>
  ) {}

  async create(tenantId: string, dto: CreateFinanceTransactionDto, userId: string, session?: any) {
    const transaction = await this.financeModel.create([
      {
        tenantId,
        type: dto.type,
        ref: dto.ref,
        partyId: dto.partyId,
        category: dto.category,
        description: dto.description,
        dueDate: dto.dueDate,
        amount: dto.amount,
        installments: dto.installments,
        payments: [],
        updatedBy: userId
      }
    ], { session });
    return transaction[0].toObject();
  }

  async findById(tenantId: string, id: string) {
    const tx = await this.financeModel.findOne({ tenantId, _id: id });
    if (!tx) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Finance transaction not found' });
    }
    return tx;
  }

  async list(
    tenantId: string,
    filters: { type?: string; paid?: string; from?: string; to?: string }
  ) {
    const query: any = { tenantId };
    if (filters.type) query.type = filters.type;
    if (filters.paid !== undefined) query.paid = filters.paid === 'true';
    if (filters.from || filters.to) {
      query.dueDate = {};
      if (filters.from) query.dueDate.$gte = new Date(filters.from);
      if (filters.to) query.dueDate.$lte = new Date(filters.to);
    }
    return this.financeModel.find(query).lean();
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
    const payment = { method: dto.method, amount: dto.amount, txid: dto.txid, at: new Date() };
    if (dto.installmentNumber !== undefined && tx.installments?.length) {
      const installment = tx.installments.find((i) => i.number === dto.installmentNumber);
      if (!installment) {
        throw new BadRequestException({ code: 'INSTALLMENT_NOT_FOUND', message: 'Installment not found' });
      }
      installment.payments.push(payment as any);
      const paidAmount = installment.payments.reduce((sum, p) => sum + p.amount, 0);
      installment.paid = paidAmount >= installment.amount - 0.01;
    } else {
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
    return tx.toObject();
  }

  async dashboard(tenantId: string, month?: string, costCenterId?: string) {
    const { start, end } = this.resolveMonthRange(month);
    const orderQuery: any = {
      tenantId,
      status: 'done',
      finishedAt: { $gte: start, $lte: end }
    };
    if (costCenterId) {
      orderQuery.$or = [{ costCenterId }, { costCenters: costCenterId }];
    }
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

    const purchaseQuery: any = { tenantId, deletedAt: null };
    if (costCenterId) {
      purchaseQuery['items.costCenterId'] = costCenterId;
    }
    const purchases = await this.purchaseModel.find(purchaseQuery).lean();
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
        message: 'from and to must be valid ISO date strings'
      });
    }
    if (end < start) {
      throw new BadRequestException({
        code: 'INVALID_PERIOD',
        message: 'to must be after from'
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

  async reconcilePayments(tenantId: string, scope: 'orders' | 'purchases' | 'all' = 'all') {
    const includeOrders = scope === 'all' || scope === 'orders';
    const includePurchases = scope === 'all' || scope === 'purchases';
    const txMap = new Map<string, any>();
    const financeTxs = await this.financeModel.find({ tenantId }).lean();
    for (const tx of financeTxs) {
      txMap.set(String(tx._id), tx);
    }
    const result: {
      orders?: any[];
      purchases?: any[];
    } = {};
    if (includeOrders) {
      const orders = await this.orderModel.find({ tenantId, deletedAt: null }).lean();
      const orderIssues = [];
      for (const order of orders) {
        const billingTotal = Number(order?.billing?.total || 0);
        const paymentSum = Array.isArray(order?.payments)
          ? order.payments.reduce((sum: number, payment: any) => sum + (payment?.amount || 0), 0)
          : 0;
        const tx = order.financeTransactionId
          ? txMap.get(String(order.financeTransactionId))
          : null;
        if (Math.abs(billingTotal - paymentSum) > 0.01) {
          orderIssues.push({
            orderId: order._id,
            issue: 'payment_sum_mismatch',
            billingTotal,
            paymentSum
          });
          continue;
        }
        if (!tx) {
          orderIssues.push({
            orderId: order._id,
            issue: 'finance_tx_missing'
          });
          continue;
        }
        if (Math.abs((tx.amount || 0) - billingTotal) > 0.01) {
          orderIssues.push({
            orderId: order._id,
            issue: 'finance_amount_mismatch',
            billingTotal,
            financeAmount: tx.amount
          });
        }
        const orderPaid = order?.billing?.status === 'paid';
        if (orderPaid !== tx.paid) {
          orderIssues.push({
            orderId: order._id,
            issue: 'finance_paid_flag_mismatch',
            orderPaid,
            financePaid: tx.paid
          });
        }
      }
      result.orders = orderIssues;
    }
    if (includePurchases) {
      const purchases = await this.purchaseModel.find({ tenantId, deletedAt: null }).lean();
      const purchaseIssues = [];
      for (const purchase of purchases) {
        const total = Number(purchase?.totals?.total || 0);
        if (purchase.status === 'canceled' || purchase.status === 'draft') {
          continue;
        }
        const tx = purchase.financeTransactionId
          ? txMap.get(String(purchase.financeTransactionId))
          : null;
        if (!tx) {
          purchaseIssues.push({
            purchaseId: purchase._id,
            issue: 'finance_tx_missing'
          });
          continue;
        }
        if (Math.abs((tx.amount || 0) - total) > 0.01) {
          purchaseIssues.push({
            purchaseId: purchase._id,
            issue: 'finance_amount_mismatch',
            purchaseTotal: total,
            financeAmount: tx.amount
          });
        }
      }
      result.purchases = purchaseIssues;
    }
    return result;
  }

  async reconcilePaymentsReport(
    tenantId: string,
    scope: 'orders' | 'purchases' | 'all' = 'all'
  ) {
    const reconciliation = await this.reconcilePayments(tenantId, scope);
    const withSuggestion = (issue: any, entity: 'order' | 'purchase') => {
      let suggestion = '';
      switch (issue.issue) {
        case 'finance_tx_missing':
          suggestion =
            entity === 'order'
              ? 'Criar transação financeira para esta OS e registrar o recebimento.'
              : 'Criar contas a pagar para esta compra e registrar o pagamento.';
          break;
        case 'finance_amount_mismatch':
          suggestion =
            entity === 'order'
              ? 'Ajustar o valor da transação financeira para coincidir com o faturamento da OS.'
              : 'Ajustar o valor da transação financeira para refletir o total da compra.';
          break;
        case 'payment_sum_mismatch':
          suggestion = 'Verificar pagamentos registrados na OS e corrigir para bater com o total faturado.';
          break;
        case 'finance_paid_flag_mismatch':
          suggestion = 'Atualizar o status pago da OS ou da transação financeira para manter consistência.';
          break;
        default:
          suggestion = 'Analisar o lançamento e corrigir manualmente.';
      }
      return { ...issue, suggestion };
    };
    return {
      orders: reconciliation.orders?.map((issue) => withSuggestion(issue, 'order')) || [],
      purchases: reconciliation.purchases?.map((issue) => withSuggestion(issue, 'purchase')) || []
    };
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
