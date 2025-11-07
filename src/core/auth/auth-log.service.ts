import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuthLoginLog, AuthLoginLogDocument } from './auth-login-log.schema';

export interface LoginLogEntry {
  email: string;
  tenantId?: string;
  userId?: string;
  success: boolean;
  message: string;
  ip?: string;
  ua?: string;
}

@Injectable()
export class AuthLogService {
  private readonly logger = new Logger(AuthLogService.name);
  constructor(@InjectModel(AuthLoginLog.name) private readonly logModel: Model<AuthLoginLogDocument>) {}

  async logLoginAttempt(entry: LoginLogEntry) {
    // Print to API terminal
    const status = entry.success ? 'SUCCESS' : 'FAIL';
    const msg = `[AUTH LOGIN] ${status} email=${entry.email} tenant=${entry.tenantId ?? '-'} user=${entry.userId ?? '-'} ip=${entry.ip ?? '-'} ua=${entry.ua ?? '-'} reason=${entry.message}`;
    if (entry.success) this.logger.log(msg);
    else this.logger.warn(msg);

    // Persist to DB (best-effort)
    try {
      await this.logModel.create(entry);
    } catch (e) {
      // swallow logging errors
    }
  }
}
