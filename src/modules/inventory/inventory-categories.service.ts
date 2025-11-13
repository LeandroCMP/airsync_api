import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InventoryCategory, InventoryCategoryDocument } from './inventory-category.schema';
import { InventoryItem, InventoryItemDocument } from './inventory-item.schema';
import { CreateInventoryCategoryDto } from './dto/create-category.dto';
import { UpdateInventoryCategoryDto } from './dto/update-category.dto';
import { calculateSellPrice } from './pricing.util';

@Injectable()
export class InventoryCategoriesService {
  constructor(
    @InjectModel(InventoryCategory.name)
    private readonly categoryModel: Model<InventoryCategoryDocument>,
    @InjectModel(InventoryItem.name)
    private readonly itemModel: Model<InventoryItemDocument>
  ) {}

  async create(tenantId: string, dto: CreateInventoryCategoryDto) {
    const category = await this.categoryModel.create({
      tenantId,
      name: dto.name,
      markupPercent: dto.markupPercent ?? 0,
      description: dto.description
    });
    return category.toObject();
  }

  async list(tenantId: string) {
    return this.categoryModel.find({ tenantId }).lean();
  }

  async update(tenantId: string, id: string, dto: UpdateInventoryCategoryDto) {
    const category = await this.categoryModel.findOne({ tenantId, _id: id });
    if (!category) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Inventory category not found' });
    }
    if (dto.name !== undefined) category.name = dto.name;
    if (dto.markupPercent !== undefined) category.markupPercent = dto.markupPercent;
    if (dto.description !== undefined) category.description = dto.description;
    await category.save();

    if (dto.markupPercent !== undefined) {
      await this.applyMarkupToItems(category);
    }
    return category.toObject();
  }

  async remove(tenantId: string, id: string) {
    const category = await this.categoryModel.findOne({ tenantId, _id: id });
    if (!category) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Inventory category not found' });
    }
    await category.deleteOne();
    await this.itemModel.updateMany(
      { tenantId, categoryId: id },
      { $set: { categoryId: null, pricingMode: 'manual' } }
    );
    return { deleted: true };
  }

  private async applyMarkupToItems(category: InventoryCategoryDocument) {
    const items = await this.itemModel.find({
      tenantId: category.tenantId,
      categoryId: category._id,
      pricingMode: 'category'
    });
    for (const item of items) {
      item.markupPercent = category.markupPercent;
      const newPrice = calculateSellPrice(item.avgCost, category.markupPercent);
      if (newPrice !== undefined) {
        item.sellPrice = newPrice;
      }
      await item.save();
    }
  }

  async findById(tenantId: string, id: string) {
    return this.categoryModel.findOne({ tenantId, _id: id });
  }
}

