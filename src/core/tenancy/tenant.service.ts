import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Tenant, TenantDocument } from './tenant.schema';

@Injectable()
export class TenantService {
  constructor(@InjectModel(Tenant.name) private readonly tenantModel: Model<TenantDocument>) {}

  async create(name: string) {
    const tenant = await this.tenantModel.create({ name });
    return tenant.toObject();
  }

  async findById(id: string) {
    return this.tenantModel.findById(id).lean();
  }
}
