import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Supplier, SupplierDocument } from './supplier.schema';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(@InjectModel(Supplier.name) private readonly supplierModel: Model<SupplierDocument>) {}

  async create(tenantId: string, dto: CreateSupplierDto, userId: string) {
    try {
      const supplier = await this.supplierModel.create({
        tenantId,
        name: dto.name,
        docNumber: dto.docNumber,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        notes: dto.notes,
        updatedBy: userId,
        deletedAt: null
      });
      return supplier.toObject();
    } catch (error) {
      this.handleMongoError(error, { action: 'create' });
    }
  }

  async search(tenantId: string, text?: string) {
    const query: any = { tenantId, deletedAt: null };
    if (text) {
      const regex = new RegExp(text, 'i');
      query.$or = [{ name: regex }, { docNumber: regex }];
    }
    return this.supplierModel.find(query).lean();
  }

  async update(tenantId: string, id: string, dto: UpdateSupplierDto, userId: string) {
    const supplier = await this.supplierModel.findOne({ tenantId, _id: id, deletedAt: null });
    if (!supplier) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Fornecedor nao encontrado.' });
    }
    if (dto.name !== undefined) supplier.name = dto.name;
    if (dto.docNumber !== undefined) supplier.docNumber = dto.docNumber;
    if (dto.phone !== undefined) supplier.phone = dto.phone;
    if (dto.email !== undefined) supplier.email = dto.email;
    if (dto.address !== undefined) supplier.address = dto.address;
    if (dto.notes !== undefined) supplier.notes = dto.notes;
    supplier.updatedBy = userId;
    try {
      await supplier.save();
    } catch (error) {
      this.handleMongoError(error, { action: 'update' });
    }
    return supplier.toObject();
  }

  async findById(tenantId: string, id: string) {
    const supplier = await this.supplierModel.findOne({ tenantId, _id: id, deletedAt: null });
    if (!supplier) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Fornecedor nao encontrado.' });
    }
    return supplier;
  }

  async remove(tenantId: string, id: string, userId: string) {
    const supplier = await this.supplierModel.findOne({ tenantId, _id: id, deletedAt: null });
    if (!supplier) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Fornecedor nao encontrado.' });
    }
    supplier.deletedAt = new Date();
    supplier.updatedBy = userId;
    await supplier.save();
    return supplier.toObject();
  }

  private handleMongoError(error: any, context: { action: 'create' | 'update' }): never {
    if (error && error.code === 11000) {
      const duplicatedFields = Object.keys(error.keyValue || {});
      const fieldsDescription = duplicatedFields.length ? duplicatedFields.join(', ') : 'chave unica';
      throw new ConflictException({
        code: 'SUPPLIER_DUPLICATE',
        message: `Fornecedor ja existe para este tenant (campos duplicados: ${fieldsDescription}).`,
        details: [
          {
            action: context.action,
            fields: duplicatedFields,
            value: error.keyValue
          }
        ]
      });
    }
    throw error;
  }
}
