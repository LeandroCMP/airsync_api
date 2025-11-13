import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InventoryItem, InventoryItemDocument } from './inventory-item.schema';
import { OpenAiService } from '../../core/openai/openai.service';

@Injectable()
export class InventoryInsightsService {
  constructor(
    @InjectModel(InventoryItem.name) private readonly inventoryModel: Model<InventoryItemDocument>,
    private readonly openAi: OpenAiService
  ) {}

  async forecast(tenantId: string) {
    const items = await this.inventoryModel.find({ tenantId, deletedAt: null }).lean();
    const context = items
      .map(
        (item) =>
          `- ${item.name} | estoque ${item.onHand} | reservado ${item.reserved} | mínimo ${item.minQty} | custo médio ${item.avgCost}`
      )
      .join('\n');
    const prompt = `Com base nos dados de estoque abaixo, sugira quais itens precisam ser recomprados nos próximos 30 dias e indique quantidades sugeridas.\n\n${context}`;
    const forecast = await this.openAi.generateInsight(prompt);
    return { forecast };
  }
}

