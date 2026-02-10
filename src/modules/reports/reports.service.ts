import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FinanceTransaction, FinanceTransactionDocument } from '../finance/finance-transaction.schema';
import { Order, OrderDocument } from '../orders/order.schema';
import { FleetVehicle, FleetVehicleDocument } from '../fleet/fleet-vehicle.schema';

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(FinanceTransaction.name)
    private readonly financeModel: Model<FinanceTransactionDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    @InjectModel(FleetVehicle.name)
    private readonly fleetModel: Model<FleetVehicleDocument>
  ) {}

  async dre(tenantId: string, from?: string, to?: string) {
    const query: any = { tenantId };
    if (from || to) {
      query.dueDate = {};
      if (from) query.dueDate.$gte = new Date(from);
      if (to) query.dueDate.$lte = new Date(to);
    }
    const txs = await this.financeModel.find(query).lean();
    const summary = { revenue: 0, expenses: 0, categories: {} as Record<string, number> };
    for (const tx of txs) {
      const amount = tx.amount;
      const sign = tx.type === 'receivable' ? 1 : -1;
      summary.categories[tx.category] = (summary.categories[tx.category] || 0) + amount * sign;
      if (tx.type === 'receivable') summary.revenue += amount;
      else summary.expenses += amount;
    }
    summary['result'] = summary.revenue - summary.expenses;
    return summary;
  }

  async kpis(tenantId: string, month?: string) {
    const now = month ? new Date(month + '-01') : new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const ordersDone = await this.orderModel.countDocuments({
      tenantId,
      status: 'done',
      finishedAt: { $gte: start, $lte: end }
    });
    const revenue = await this.financeModel.aggregate([
      {
        $match: {
          tenantId,
          type: 'receivable',
          dueDate: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);
    return {
      month: start.toISOString().slice(0, 7),
      ordersDone,
      revenue: revenue[0]?.total || 0
    };
  }

  async fleetCosts(tenantId: string, from?: string, to?: string, by: 'km' | 'vehicle' = 'vehicle') {
    const vehicles = await this.fleetModel.find({ tenantId }).lean();
    const fromDate = from ? new Date(from) : new Date(0);
    const toDate = to ? new Date(to) : new Date();
    const summary: any = {};
    for (const vehicle of vehicles) {
      const periodFuelLogs = vehicle.fuelLogs
        .filter(
        (log) => new Date(log.at) >= fromDate && new Date(log.at) <= toDate
        )
        .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
      const fuelCost = periodFuelLogs.reduce((sum, log) => sum + log.cost, 0);
      const maintCost = vehicle.maintenances
        .filter((m) => new Date(m.at) >= fromDate && new Date(m.at) <= toDate)
        .reduce((sum, m) => sum + m.cost, 0);
      const km = periodFuelLogs.length
        ? periodFuelLogs[periodFuelLogs.length - 1].km - periodFuelLogs[0].km
        : 0;
      const total = fuelCost + maintCost;
      if (by === 'vehicle') {
        summary[vehicle.plate] = { total, fuelCost, maintCost };
      } else {
        summary[vehicle.plate] = { costPerKm: km ? total / km : 0 };
      }
    }
    return summary;
  }
}
