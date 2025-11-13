import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { extname } from 'path';
import { User, UserDocument, UserRole } from './user.schema';
import { UserPayroll, UserPayrollDocument, PayrollPaymentMethod, PayrollStatus } from './user-payroll.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserPayrollDto } from './dto/create-user-payroll.dto';
import { UpdateUserPayrollDto } from './dto/update-user-payroll.dto';
import * as bcrypt from 'bcrypt';
import {
  ALL_PERMISSION_CODES,
  USER_PERMISSION_CATALOG,
  ROLE_PERMISSION_PRESETS,
  resolveDefaultPermissions,
  normalizePermissions
} from './user-permissions.constants';
import { FinanceService } from '../finance/finance.service';
import { FilesService } from '../../core/files/files.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(UserPayroll.name) private readonly payrollModel: Model<UserPayrollDocument>,
    private readonly financeService: FinanceService,
    private readonly filesService: FilesService
  ) {}

  private ensurePermissionsValid(perms?: string[]): string[] | undefined {
    if (perms === undefined) {
      return undefined;
    }
    const invalid = (perms || []).filter((perm) => !ALL_PERMISSION_CODES.includes(perm as any));
    if (invalid.length) {
      throw new BadRequestException({
        code: 'INVALID_PERMISSION',
        message: `Invalid permissions: ${invalid.join(', ')}`,
        details: invalid
      });
    }
    return normalizePermissions(perms);
  }

  private resolvePermissions(role: UserRole, perms?: string[]): string[] {
    const validated = this.ensurePermissionsValid(perms);
    if (validated && validated.length) {
      return validated;
    }
    return resolveDefaultPermissions(role);
  }

  private buildCompensationFromCreate(dto: CreateUserDto) {
    const compensation: Record<string, any> = {};
    if (dto.salary !== undefined) compensation.salary = dto.salary;
    if (dto.paymentDay !== undefined) compensation.paymentDay = dto.paymentDay;
    if (dto.paymentFrequency) compensation.paymentFrequency = dto.paymentFrequency;
    if (dto.paymentMethod) compensation.paymentMethod = dto.paymentMethod;
    if (dto.compensationNotes) compensation.notes = dto.compensationNotes;
    return compensation;
  }

  private applyCompensationUpdates(user: UserDocument, dto: UpdateUserDto) {
    if (
      dto.salary === undefined &&
      dto.paymentDay === undefined &&
      dto.paymentFrequency === undefined &&
      dto.paymentMethod === undefined &&
      dto.compensationNotes === undefined
    ) {
      return;
    }
    const compensation = user.compensation || {};
    if (dto.salary !== undefined) compensation.salary = dto.salary;
    if (dto.paymentDay !== undefined) compensation.paymentDay = dto.paymentDay;
    if (dto.paymentFrequency !== undefined) compensation.paymentFrequency = dto.paymentFrequency;
    if (dto.paymentMethod !== undefined) compensation.paymentMethod = dto.paymentMethod;
    if (dto.compensationNotes !== undefined) compensation.notes = dto.compensationNotes;
    user.compensation = compensation as any;
  }

  sanitize(user: any) {
    if (!user) return user;
    const obj = user.toObject ? user.toObject() : user;
    delete obj.passwordHash;
    return obj;
  }

  async create(tenantId: string, dto: CreateUserDto, by: string) {
    const exists = await this.userModel.exists({ email: dto.email.toLowerCase(), deletedAt: null });
    if (exists) {
      throw new ConflictException({ code: 'EMAIL_TAKEN', message: 'Email already in use' });
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const compensation = this.buildCompensationFromCreate(dto);
    let created: any;
    try {
      created = await this.userModel.create({
        tenantId,
        name: dto.name,
        email: dto.email.toLowerCase(),
        passwordHash,
        role: dto.role,
        permissions: this.resolvePermissions(dto.role, dto.permissions),
        hourlyCost: dto.hourlyCost,
        compensation,
        active: dto.active ?? true,
        updatedBy: by,
        deletedAt: null
      });
    } catch (err: any) {
      if (err && (err.code === 11000 || /duplicate key/i.test(String(err.message)))) {
        throw new ConflictException({ code: 'EMAIL_TAKEN', message: 'Email already in use' });
      }
      throw err;
    }
    return this.sanitize(created);
  }

  async findByEmail(tenantId: string, email: string) {
    return this.userModel.findOne({ tenantId, email: email.toLowerCase(), deletedAt: null });
  }

  async findByEmailAnyTenant(email: string) {
    return this.userModel.findOne({ email: email.toLowerCase(), deletedAt: null });
  }

  async updateSelf(tenantId: string, userId: string, dto: { name?: string; email?: string }) {
    const user = await this.userModel.findOne({ tenantId, _id: userId, deletedAt: null });
    if (!user) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'User not found' });
    }
    if (dto.email && dto.email.toLowerCase() !== user.email) {
      const exists = await this.userModel.exists({
        email: dto.email.toLowerCase(),
        deletedAt: null,
        _id: { $ne: user._id }
      });
      if (exists) {
        throw new ConflictException({ code: 'EMAIL_TAKEN', message: 'Email already in use' });
      }
      user.email = dto.email.toLowerCase();
    }
    if (dto.name !== undefined) {
      user.name = dto.name;
    }
    user.updatedBy = userId;
    await user.save();
    return this.sanitize(user);
  }

  async changePassword(tenantId: string, userId: string, currentPassword: string, newPassword: string) {
    const user = await this.userModel.findOne({ tenantId, _id: userId, deletedAt: null });
    if (!user) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'User not found' });
    }
    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) {
      throw new BadRequestException({
        code: 'INVALID_CURRENT_PASSWORD',
        message: 'Senha atual incorreta'
      });
    }
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.updatedBy = userId;
    await user.save();
  }

  async forcePasswordChange(tenantId: string, userId: string, newPassword: string, updatedBy: string) {
    const user = await this.userModel.findOne({ tenantId, _id: userId, deletedAt: null });
    if (!user) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'User not found' });
    }
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.updatedBy = updatedBy;
    await user.save();
    return this.sanitize(user);
  }

  async findAll(tenantId: string, role?: string) {
    const query: any = { tenantId, deletedAt: null };
    if (role) {
      query.role = role;
    }
    const users = await this.userModel.find(query).lean();
    return users.map((user) => this.sanitize(user));
  }

  async findById(tenantId: string, id: string) {
    return this.userModel.findOne({ tenantId, _id: id, deletedAt: null });
  }

  async update(tenantId: string, id: string, dto: UpdateUserDto, by: string) {
    const user = await this.findById(tenantId, id);
    if (!user) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'User not found' });
    }
    const targetRole = (dto.role || user.role) as UserRole;
    if (dto.permissions !== undefined) {
      user.permissions = this.resolvePermissions(targetRole, dto.permissions);
    } else if (dto.role && dto.role !== user.role) {
      user.permissions = this.resolvePermissions(dto.role as UserRole);
    }
    if (dto.name) user.name = dto.name;
    if (dto.role) user.role = dto.role;
    if (dto.hourlyCost !== undefined) user.hourlyCost = dto.hourlyCost;
    if (dto.active !== undefined) user.active = dto.active;
    this.applyCompensationUpdates(user, dto);
    user.updatedBy = by;
    await user.save();
    return this.sanitize(user);
  }

  getPermissionCatalog() {
    return USER_PERMISSION_CATALOG;
  }

  getRolePresets() {
    return Object.entries(ROLE_PERMISSION_PRESETS).map(([role, permissions]) => ({
      role,
      permissions
    }));
  }

  private async saveAttachment(base64?: string, filename?: string) {
    if (!base64) return undefined;
    let extension = 'pdf';
    if (filename) {
      const ext = extname(filename);
      if (ext) {
        extension = ext.replace('.', '') || extension;
      }
    }
    return this.filesService.saveBase64(base64, extension);
  }

  private computeDueDate(reference: string, preferredDay?: number) {
    const [yearStr, monthStr] = reference.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    if (!year || !month) {
      return new Date();
    }
    const lastDay = new Date(year, month, 0).getDate();
    let day = preferredDay ?? lastDay;
    if (day > lastDay) day = lastDay;
    const utcDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    return utcDate;
  }

  private mapPayroll(payroll: UserPayrollDocument | any) {
    const obj = payroll.toObject ? payroll.toObject() : payroll;
    return obj;
  }

  private async syncFinanceTransaction(
    tenantId: string,
    payroll: UserPayrollDocument,
    by: string
  ) {
    if (!payroll.financeTransactionId) return;
    const tx = await this.financeService.findById(tenantId, payroll.financeTransactionId);
    if (!tx) return;
    tx.amount = payroll.amount;
    if (payroll.dueDate) {
      tx.dueDate = payroll.dueDate;
    }
    tx.description = `Folha de pagamento ${payroll.reference}`;
    tx.partyId = payroll.userId;
    tx.updatedBy = by;
    await tx.save();
  }

  private async markPayrollAsPaid(
    tenantId: string,
    payroll: UserPayrollDocument,
    method: PayrollPaymentMethod | undefined,
    amount: number,
    by: string,
    paidAt?: Date
  ): Promise<UserPayrollDocument> {
    const paymentMethod = method || 'BANK_TRANSFER';
    if (payroll.financeTransactionId) {
      await this.financeService.pay(
        tenantId,
        payroll.financeTransactionId,
        { method: paymentMethod, amount },
        by
      );
    }
    payroll.status = 'paid';
    payroll.paymentMethod = paymentMethod;
    payroll.paidAt = paidAt ?? new Date();
    payroll.updatedBy = by;
    await payroll.save();
    return payroll as UserPayrollDocument;
  }

  async createPayroll(
    tenantId: string,
    userId: string,
    dto: CreateUserPayrollDto,
    by: string
  ) {
    const user = await this.findById(tenantId, userId);
    if (!user) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'User not found' });
    }
    const isPaidRequested = dto.status === 'paid' || dto.paidAt !== undefined;
    const payroll = new this.payrollModel({
      tenantId,
      userId,
      reference: dto.reference,
      amount: dto.amount,
      status: isPaidRequested ? 'pending' : (dto.status ?? 'pending'),
      dueDate: dto.dueDate ? new Date(dto.dueDate) : this.computeDueDate(dto.reference, user.compensation?.paymentDay),
      paymentMethod: dto.paymentMethod ?? user.compensation?.paymentMethod,
      notes: dto.notes,
      createdBy: by,
      updatedBy: by
    });

    if (dto.attachmentBase64) {
      payroll.attachmentUrl = await this.saveAttachment(dto.attachmentBase64, dto.attachmentFilename);
    }

    try {
      await payroll.save();
    } catch (err: any) {
      if (err && err.code === 11000) {
        throw new ConflictException({
          code: 'PAYROLL_DUPLICATE_REFERENCE',
          message: 'Payroll already exists for this reference'
        });
      }
      throw err;
    }

    const financeTx = await this.financeService.create(
      tenantId,
      {
        type: 'payable',
        ref: `payroll:${payroll.id}`,
        partyId: userId,
        category: 'payroll',
        description: `Folha de pagamento ${dto.reference} - ${user.name}`,
        dueDate: payroll.dueDate ?? new Date(),
        amount: payroll.amount
      },
      by
    );

    payroll.financeTransactionId = financeTx._id?.toString?.() ?? financeTx._id;
    await payroll.save();

    let finalPayroll: UserPayrollDocument = payroll;
    if (isPaidRequested) {
      const paidAt = dto.paidAt ? new Date(dto.paidAt) : undefined;
      finalPayroll = await this.markPayrollAsPaid(
        tenantId,
        payroll,
        dto.paymentMethod ?? user.compensation?.paymentMethod,
        payroll.amount,
        by,
        paidAt
      );
    }

    return this.mapPayroll(finalPayroll);
  }

  async listPayroll(tenantId: string, userId: string) {
    const user = await this.findById(tenantId, userId);
    if (!user) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'User not found' });
    }
    const entries = await this.payrollModel
      .find({ tenantId, userId })
      .sort({ reference: -1, createdAt: -1 })
      .lean();
    return entries;
  }

  async getPayroll(tenantId: string, userId: string, payrollId: string) {
    const payroll = await this.payrollModel.findOne({ tenantId, _id: payrollId, userId });
    if (!payroll) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Payroll entry not found' });
    }
    return this.mapPayroll(payroll);
  }

  async updatePayroll(
    tenantId: string,
    userId: string,
    payrollId: string,
    dto: UpdateUserPayrollDto,
    by: string
  ) {
    const payroll = await this.payrollModel.findOne({ tenantId, _id: payrollId, userId });
    if (!payroll) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Payroll entry not found' });
    }
    if (dto.reference) {
      payroll.reference = dto.reference;
    }
    if (dto.amount !== undefined) {
      if (payroll.status === 'paid') {
        throw new BadRequestException({
          code: 'PAYROLL_ALREADY_PAID',
          message: 'Cannot change amount after payment'
        });
      }
      payroll.amount = dto.amount;
    }
    if (dto.dueDate) {
      payroll.dueDate = new Date(dto.dueDate);
    }
    if (dto.notes !== undefined) {
      payroll.notes = dto.notes;
    }
    if (dto.paymentMethod !== undefined) {
      payroll.paymentMethod = dto.paymentMethod;
    }
    if (dto.attachmentBase64) {
      payroll.attachmentUrl = await this.saveAttachment(dto.attachmentBase64, dto.attachmentFilename);
    }

    payroll.updatedBy = by;
    try {
      await payroll.save();
    } catch (err: any) {
      if (err && err.code === 11000) {
        throw new ConflictException({
          code: 'PAYROLL_DUPLICATE_REFERENCE',
          message: 'Payroll already exists for this reference'
        });
      }
      throw err;
    }

    await this.syncFinanceTransaction(tenantId, payroll, by);

    const shouldMarkPaid =
      (dto.status === 'paid' || (!!dto.paidAt && payroll.status !== 'paid')) && payroll.status !== 'paid';

    if (shouldMarkPaid) {
      const paidAt = dto.paidAt ? new Date(dto.paidAt) : undefined;
      await this.markPayrollAsPaid(
        tenantId,
        payroll,
        dto.paymentMethod ?? payroll.paymentMethod,
        payroll.amount,
        by,
        paidAt
      );
    } else if (dto.status && dto.status !== 'paid') {
      if (payroll.status === 'paid') {
        throw new BadRequestException({
          code: 'PAYROLL_ALREADY_PAID',
          message: 'Cannot revert a payroll already marked as paid'
        });
      }
      payroll.status = dto.status as PayrollStatus;
      payroll.paidAt = undefined;
      await payroll.save();
    }

    return this.mapPayroll(payroll);
  }
}
