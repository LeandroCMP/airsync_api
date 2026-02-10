import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Client, ClientDocument } from './client.schema';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);

  constructor(@InjectModel(Client.name) private readonly clientModel: Model<ClientDocument>) {}

  private normalizePhones(phones?: string[] | string) {
    if (!phones) return [];
    const list = Array.isArray(phones) ? phones : [phones];
    return list
      .map((p) => (p || '').replace(/\D/g, ''))
      .filter(Boolean);
  }

  private normalizeEmails(emails?: string[] | string) {
    if (!emails) return [];
    const list = Array.isArray(emails) ? emails : [emails];
    return list
      .map((e) => (e || '').trim().toLowerCase())
      .filter(Boolean);
  }

  async create(tenantId: string, dto: CreateClientDto, userId: string) {
    const client = await this.clientModel.create({
      tenantId,
      name: dto.name,
      docNumber: dto.docNumber,
      phones: this.normalizePhones(dto.phones),
      emails: this.normalizeEmails(dto.emails),
      notes: dto.notes,
      updatedBy: userId,
      deletedAt: null
    });
    this.logger.log(`Cliente criado | tenant=${tenantId} id=${client._id.toString()} nome=${client.name}`);
    return client.toObject();
  }

  async search(tenantId: string, text?: string, limit = 20) {
    const query: any = { tenantId, deletedAt: null };
    if (text) {
      const regex = new RegExp(text, 'i');
      query.$or = [{ name: regex }, { docNumber: regex }, { phones: regex }, { emails: regex }];
    }
    const clients = await this.clientModel.find(query).limit(limit).lean();
    return clients;
  }

  async findById(tenantId: string, id: string) {
    const client = await this.clientModel.findOne({ tenantId, _id: id, deletedAt: null });
    if (!client) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Cliente nao encontrado.' });
    }
    return client;
  }

  async update(tenantId: string, id: string, dto: UpdateClientDto, userId: string) {
    const client = await this.findById(tenantId, id);
    if (dto.name) client.name = dto.name;
    if (dto.docNumber !== undefined) client.docNumber = dto.docNumber;
    if (dto.phones) client.phones = this.normalizePhones(dto.phones);
    if (dto.emails) client.emails = this.normalizeEmails(dto.emails);
    if (dto.notes !== undefined) client.notes = dto.notes;
    client.updatedBy = userId;
    await client.save();
    this.logger.log(`Cliente atualizado | tenant=${tenantId} id=${id}`);
    return client.toObject();
  }

  async remove(tenantId: string, id: string, userId: string) {
    const client = await this.findById(tenantId, id);
    client.deletedAt = new Date();
    client.updatedBy = userId;
    await client.save();
    this.logger.log(`Cliente removido (soft) | tenant=${tenantId} id=${id}`);
    return client.toObject();
  }
}
