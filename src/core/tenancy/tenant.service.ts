import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Tenant, TenantDocument } from './tenant.schema';
import { UpdateTenantProfileDto } from './dto/update-tenant-profile.dto';

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

  private validateProfile(dto: UpdateTenantProfileDto) {
    if (dto.creditFees) {
      const seen = new Set<number>();
      for (const fee of dto.creditFees) {
        if (seen.has(fee.installments)) {
          throw new BadRequestException({
            code: 'DUPLICATE_INSTALLMENTS',
            message: `Duplicate installment entry: ${fee.installments}x`
          });
        }
        seen.add(fee.installments);
        if (fee.feePercent < 0) {
          throw new BadRequestException({
            code: 'INVALID_FEE',
            message: 'Fee percent must be >= 0'
          });
        }
      }
      dto.creditFees = dto.creditFees.sort((a, b) => a.installments - b.installments);
    }
    if (
      (dto.debitFeePercent !== undefined && dto.debitFeePercent < 0) ||
      (dto.chequeFeePercent !== undefined && dto.chequeFeePercent < 0)
    ) {
      throw new BadRequestException({
        code: 'INVALID_FEE',
        message: 'Fee percent must be >= 0'
      });
    }
  }

  async updateProfile(tenantId: string, dto: UpdateTenantProfileDto) {
    this.validateProfile(dto);
    const update: any = {};
    if (dto.name !== undefined) update.name = dto.name;
    if (dto.pixKey !== undefined) update.pixKey = dto.pixKey;
    if (dto.creditFees !== undefined) update.creditFees = dto.creditFees;
    if (dto.debitFeePercent !== undefined) update.debitFeePercent = dto.debitFeePercent;
    if (dto.chequeFeePercent !== undefined) update.chequeFeePercent = dto.chequeFeePercent;
    const tenant = await this.tenantModel.findByIdAndUpdate(tenantId, update, { new: true, lean: true });
    return tenant;
  }
}
