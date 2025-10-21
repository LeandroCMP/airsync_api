import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Contract, ContractDocument } from './contract.schema';
import { CreateContractDto } from './dto/create-contract.dto';
import { ScheduleNextDto } from './dto/schedule-next.dto';
import { OrdersService } from '../orders/orders.service';

@Injectable()
export class ContractsService {
  constructor(
    @InjectModel(Contract.name) private readonly contractModel: Model<ContractDocument>,
    private readonly ordersService: OrdersService
  ) {}

  async create(tenantId: string, dto: CreateContractDto, userId: string) {
    const contract = await this.contractModel.create({
      tenantId,
      clientId: dto.clientId,
      equipmentIds: dto.equipmentIds || [],
      plan: dto.plan,
      nextVisits: dto.nextVisits || [],
      priceMonthly: dto.priceMonthly,
      status: dto.status,
      notes: dto.notes
    });
    return contract.toObject();
  }

  async list(tenantId: string, filters: { status?: string; clientId?: string }) {
    const query: any = { tenantId };
    if (filters.status) query.status = filters.status;
    if (filters.clientId) query.clientId = filters.clientId;
    return this.contractModel.find(query).lean();
  }

  async findById(tenantId: string, id: string) {
    const contract = await this.contractModel.findOne({ tenantId, _id: id });
    if (!contract) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Contract not found' });
    }
    return contract;
  }

  async scheduleNext(tenantId: string, id: string, dto: ScheduleNextDto, userId: string) {
    const contract = await this.findById(tenantId, id);
    contract.nextVisits.push(new Date(dto.visitAt));
    await contract.save();
    await this.ordersService.create(
      tenantId,
      {
        clientId: contract.clientId,
        locationId: dto.locationId,
        equipmentId: contract.equipmentIds?.[0],
        status: 'scheduled',
        scheduledAt: dto.visitAt,
        technicianIds: [],
        checklist: [],
        materials: [],
        billingItems: [],
        notes: `Visita contrato ${contract.plan.name}`
      } as any,
      userId
    );
    return contract.toObject();
  }
}
