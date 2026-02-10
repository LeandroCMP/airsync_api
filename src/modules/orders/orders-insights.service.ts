import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order, OrderDocument } from './order.schema';
import { OpenAiService } from '../../core/openai/openai.service';

@Injectable()
export class OrdersInsightsService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    private readonly openAi: OpenAiService
  ) {}

  async assistant(tenantId: string, orderId: string, question: string) {
    const context = await this.buildOrderContext(tenantId, orderId);
    const prompt = `You are a senior HVAC technician assistant. Use the order data below to answer the technician's question.\n\n${context}\n\nQuestion: ${question}`;
    const answer = await this.openAi.generateInsight(prompt);
    return { answer };
  }

  async clientSummary(tenantId: string, orderId: string) {
    const context = await this.buildOrderContext(tenantId, orderId);
    const prompt = `Write a friendly summary for the client about this service order. Highlight what was done, materials used, and next steps.\n\n${context}`;
    const summary = await this.openAi.generateInsight(prompt);
    return { summary };
  }

  private async buildOrderContext(tenantId: string, orderId: string) {
    const order = await this.orderModel
      .findOne({ tenantId, _id: orderId, deletedAt: null })
      .lean();
    if (!order) {
      throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found' });
    }
    const materials = (order.materials || [])
      .map(
        (m) =>
          `- ${m.itemName || m.itemId}: ${m.qty} ${m.unitCost ? `(unit cost ${m.unitCost})` : ''}`
      )
      .join('\n');
    const payments = (order.payments || [])
      .map((p) => `- ${p.method}: ${p.amount}`)
      .join('\n');
    return [
      `Order ID: ${order._id}`,
      `Status: ${order.status}`,
      `Client: ${order.clientId}`,
      `Location: ${order.locationId}`,
      `Equipment: ${order.equipmentId || 'n/a'}`,
      `ScheduledAt: ${order.scheduledAt}`,
      `FinishedAt: ${order.finishedAt}`,
      `Checklist pending: ${(order.checklist || []).filter((c) => !c.done).map((c) => c.item).join(', ') || 'none'}`,
      `Materials:\n${materials || 'none'}`,
      `Billing total: ${order.billing?.total || 0}`,
      `Payments:\n${payments || 'none'}`,
      `Notes: ${order.notes || 'n/a'}`
    ].join('\n');
  }
}

