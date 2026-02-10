import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FinanceTransaction, FinanceTransactionDocument } from './finance-transaction.schema';
import { Purchase, PurchaseDocument } from '../purchases/purchase.schema';
import { Order, OrderDocument } from '../orders/order.schema';
import { OpenAiService } from '../../core/openai/openai.service';

@Injectable()
export class FinanceInsightsService {
  constructor(
    @InjectModel(FinanceTransaction.name)
    private readonly financeModel: Model<FinanceTransactionDocument>,
    @InjectModel(Purchase.name)
    private readonly purchaseModel: Model<PurchaseDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    private readonly openAi: OpenAiService
  ) {}

  async anomalies(tenantId: string, month?: string) {
    const { start, end } = this.resolveRange(month);
    const txs = await this.financeModel
      .find({
        tenantId,
        dueDate: { $gte: start, $lte: end }
      })
      .lean();
    const purchases = await this.purchaseModel
      .find({
        tenantId,
        createdAt: { $gte: start, $lte: end },
        deletedAt: null
      })
      .lean();
    const orders = await this.orderModel
      .find({
        tenantId,
        finishedAt: { $gte: start, $lte: end },
        deletedAt: null
      })
      .lean();
    const context = this.buildContext(txs, purchases, orders);
    const prompt = `Analise os dados financeiros abaixo e identifique possíveis anomalias (custos altos, margens negativas, pagamentos em atraso). Sugira próximos passos para cada item encontrado.\n\n${context}`;
    const analysis = await this.openAi.generateInsight(prompt);
    return { period: { from: start, to: end }, analysis };
  }

  private buildContext(txs: any[], purchases: any[], orders: any[]) {
    const txSummary = txs
      .slice(0, 50)
      .map((tx) => `- ${tx.type.toUpperCase()} ${tx.category} R$${tx.amount} | due: ${tx.dueDate} | paid: ${tx.paid}`)
      .join('\n');
    const purchaseSummary = purchases
      .slice(0, 20)
      .map(
        (p) =>
          `- Purchase ${p._id} status ${p.status} total ${p?.totals?.total} supplier ${p.supplierId}`
      )
      .join('\n');
    const orderSummary = orders
      .slice(0, 20)
      .map((o) => `- Order ${o._id} total ${o?.billing?.total} costs ${JSON.stringify(o.costs || {})}`)
      .join('\n');
    return `Finance transactions:\n${txSummary}\n\nPurchases:\n${purchaseSummary}\n\nOrders:\n${orderSummary}`;
  }

  private resolveRange(month?: string) {
    const now = month ? new Date(`${month}-01`) : new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }
}

