import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { InventoryCategoriesController } from './inventory-categories.controller';
import { InventoryInsightsController } from './inventory-insights.controller';
import { InventoryCategoriesService } from './inventory-categories.service';
import { InventoryInsightsService } from './inventory-insights.service';
import { MongooseModule } from '@nestjs/mongoose';
import { InventoryItem, InventoryItemSchema } from './inventory-item.schema';
import { InventoryCategory, InventoryCategorySchema } from './inventory-category.schema';
import { OpenAiModule } from '../../core/openai/openai.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: InventoryItem.name, schema: InventoryItemSchema },
      { name: InventoryCategory.name, schema: InventoryCategorySchema }
    ]),
    OpenAiModule
  ],
  controllers: [InventoryController, InventoryCategoriesController, InventoryInsightsController],
  providers: [InventoryService, InventoryCategoriesService, InventoryInsightsService],
  exports: [InventoryService, InventoryCategoriesService]
})
export class InventoryModule {}
