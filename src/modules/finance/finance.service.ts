import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FinanceTransaction, FinanceTransactionDocument } from './finance-transaction.schema';
import { CreateFinanceTransactionDto } from './dto/create-transaction.dto';
import { PayTransactionDto } from './dto/pay-transaction.dto';

@Injectable()
export class FinanceService {
  constructor(
    @InjectModel(FinanceTransaction.name)
    private readonly financeModel: Model<FinanceTransactionDocument>
  ) {}

  async create(tenantId: string, dto: CreateFinanceTransactionDto, userId: string, session?: any) {
    const transaction = await this.financeModel.create([
      {
        tenantId,
        type: dto.type,
        ref: dto.ref,
        partyId: dto.partyId,
        category: dto.category,
        description: dto.description,
        dueDate: dto.dueDate,
        amount: dto.amount,
        installments: dto.installments,
        payments: [],
        updatedBy: userId
      }
    ], { session });
    return transaction[0].toObject();
  }

  async findById(tenantId: string, id: string) {
    const tx = await this.financeModel.findOne({ tenantId, _id: id });
    if (!tx) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Finance transaction not found' });
    }
    return tx;
  }

  async list(
    tenantId: string,
    filters: { type?: string; paid?: string; from?: string; to?: string }
  ) {
    const query: any = { tenantId };
    if (filters.type) query.type = filters.type;
    if (filters.paid !== undefined) query.paid = filters.paid === 'true';
    if (filters.from || filters.to) {
      query.dueDate = {};
      if (filters.from) query.dueDate.$gte = new Date(filters.from);
      if (filters.to) query.dueDate.$lte = new Date(filters.to);
    }
    return this.financeModel.find(query).lean();
  }

  async pay(tenantId: string, id: string, dto: PayTransactionDto, userId: string) {
    const tx = await this.findById(tenantId, id);
    const payment = { method: dto.method, amount: dto.amount, txid: dto.txid, at: new Date() };
    if (dto.installmentNumber !== undefined && tx.installments?.length) {
      const installment = tx.installments.find((i) => i.number === dto.installmentNumber);
      if (!installment) {
        throw new BadRequestException({ code: 'INSTALLMENT_NOT_FOUND', message: 'Installment not found' });
      }
      installment.payments.push(payment as any);
      const paidAmount = installment.payments.reduce((sum, p) => sum + p.amount, 0);
      installment.paid = paidAmount >= installment.amount - 0.01;
    } else {
      tx.payments.push(payment as any);
    }
    const totalPaid = (
      tx.payments.reduce((sum, p) => sum + p.amount, 0) +
      (tx.installments?.reduce((sum, inst) => sum + inst.payments.reduce((s, p) => s + p.amount, 0), 0) || 0)
    );
    if (totalPaid >= tx.amount - 0.01) {
      tx.paid = true;
    }
    tx.updatedBy = userId;
    await tx.save();
    return tx.toObject();
  }
}
