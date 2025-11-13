import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CostCenter, CostCenterDocument } from './cost-center.schema';
import { CreateCostCenterDto } from './dto/create-cost-center.dto';
import { UpdateCostCenterDto } from './dto/update-cost-center.dto';

@Injectable()
export class CostCentersService {
  constructor(
    @InjectModel(CostCenter.name) private readonly costCenterModel: Model<CostCenterDocument>
  ) {}

  async create(tenantId: string, dto: CreateCostCenterDto) {
    try {
      const center = await this.costCenterModel.create({
        tenantId,
        name: dto.name,
        code: dto.code,
        type: dto.type ?? 'operational',
        description: dto.description,
        active: dto.active ?? true
      });
      return center.toObject();
    } catch (err: any) {
      if (err && (err.code === 11000 || /duplicate key/i.test(String(err.message)))) {
        throw new ConflictException({ code: 'COST_CENTER_DUPLICATE', message: 'Cost center code already exists' });
      }
      throw err;
    }
  }

  async list(tenantId: string, onlyActive = false) {
    const query: any = { tenantId };
    if (onlyActive) {
      query.active = true;
    }
    return this.costCenterModel.find(query).sort({ name: 1 }).lean();
  }

  async findById(tenantId: string, id: string) {
    const center = await this.costCenterModel.findOne({ tenantId, _id: id });
    if (!center) {
      throw new NotFoundException({ code: 'COST_CENTER_NOT_FOUND', message: 'Cost center not found' });
    }
    return center;
  }

  async update(tenantId: string, id: string, dto: UpdateCostCenterDto) {
    const center = await this.findById(tenantId, id);
    if (dto.name !== undefined) center.name = dto.name;
    if (dto.code !== undefined) center.code = dto.code;
    if (dto.type !== undefined) center.type = dto.type;
    if (dto.description !== undefined) center.description = dto.description;
    if (dto.active !== undefined) center.active = dto.active;
    try {
      await center.save();
    } catch (err: any) {
      if (err && (err.code === 11000 || /duplicate key/i.test(String(err.message)))) {
        throw new ConflictException({ code: 'COST_CENTER_DUPLICATE', message: 'Cost center code already exists' });
      }
      throw err;
    }
    return center.toObject();
  }

  async remove(tenantId: string, id: string) {
    const center = await this.findById(tenantId, id);
    await center.deleteOne();
    return { deleted: true };
  }
}

