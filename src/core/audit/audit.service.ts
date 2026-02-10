import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLog, AuditLogDocument } from './audit-log.schema';

export interface AuditEntry {
  tenantId: string;
  entity: string;
  entityId: string;
  action: 'create' | 'update' | 'delete';
  before?: any;
  after?: any;
  by: string;
  ip?: string;
}

@Injectable()
export class AuditService {
  constructor(@InjectModel(AuditLog.name) private readonly auditModel: Model<AuditLogDocument>) {}

  async log(entry: AuditEntry) {
    await this.auditModel.create(entry);
  }
}
