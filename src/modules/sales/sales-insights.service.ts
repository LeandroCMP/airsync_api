import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SaleOrder, SaleOrderDocument } from './sales-order.schema';
import { OpenAiService } from '../../core/openai/openai.service';

@Injectable()
export class SalesInsightsService {
  constructor(
    @InjectModel(SaleOrder.name) private readonly saleModel: Model<SaleOrderDocument>,
    private readonly openAi: OpenAiService
  ) {}

  async proposal(tenantId: string, saleId: string) {
    const context = await this.buildSaleContext(tenantId, saleId);
    const prompt = `Using the sale data below, write a clear proposal that can be shared with the client. Highlight itens vendidos, preços e próximos passos.\n\n${context}`;
    const proposal = await this.openAi.generateInsight(prompt);
    return { proposal };
  }

  async chat(tenantId: string, saleId: string, question: string) {
    const context = await this.buildSaleContext(tenantId, saleId);
    const prompt = `You are a sales assistant for HVAC solutions. Use the sale data below to answer the question.\n\n${context}\n\nQuestion: ${question}`;
    const answer = await this.openAi.generateInsight(prompt);
    return { answer };
  }

  private async buildSaleContext(tenantId: string, saleId: string) {
    const sale = await this.saleModel.findOne({ tenantId, _id: saleId, deletedAt: null }).lean();
    if (!sale) {
      throw new NotFoundException({ code: 'SALE_NOT_FOUND', message: 'Sale not found' });
    }
    const items = (sale.items || [])
      .map(
        (item) =>
          `- ${item.type.toUpperCase()} ${item.name}: ${item.qty} x ${item.unitPrice} (instalação: ${
            item.requiresInstallation ? 'sim' : 'não'
          })`
      )
      .join('\n');
    return [
      `Sale ID: ${sale._id}`,
      `Status: ${sale.status}`,
      `Client: ${sale.clientId}`,
      `Location: ${sale.locationId}`,
      `Cost center: ${sale.costCenterId || 'n/a'}`,
      `Totals: subtotal ${sale.totals.subtotal}, discount ${sale.totals.discount}, total ${sale.totals.total}`,
      `Items:\n${items || 'none'}`,
      `Move request: ${
        sale.moveRequest
          ? `equipment ${sale.moveRequest.equipmentId} -> location ${sale.moveRequest.toLocationId} / room ${sale.moveRequest.toRoom}`
          : 'none'
      }`,
      `Notes: ${sale.notes || 'n/a'}`
    ].join('\n');
  }
}

