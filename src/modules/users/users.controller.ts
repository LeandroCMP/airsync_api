import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserPayrollDto } from './dto/create-user-payroll.dto';
import { UpdateUserPayrollDto } from './dto/update-user-payroll.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { withAudit } from '../../common/utils/audit.util';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Permissions('users.write')
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateUserDto
  ) {
    const created = await this.usersService.create(tenantId, dto, user.id);
    return withAudit(created, {
      tenantId,
      entity: 'users',
      entityId: String(created._id),
      action: 'create',
      after: created,
      by: user.id
    });
  }

  @Get('permission-catalog')
  @Permissions('users.write')
  getPermissionCatalog() {
    return this.usersService.getPermissionCatalog();
  }

  @Get('role-presets')
  @Permissions('users.write')
  getRolePresets() {
    return this.usersService.getRolePresets();
  }

  @Get()
  async findAll(@TenantId() tenantId: string, @Query('role') role?: string) {
    return this.usersService.findAll(tenantId, role);
  }

  @Get(':id/payroll')
  @Permissions('finance.read')
  async listPayroll(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.usersService.listPayroll(tenantId, id);
  }

  @Post(':id/payroll')
  @Permissions('finance.write')
  async createPayroll(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: CreateUserPayrollDto
  ) {
    const payroll = await this.usersService.createPayroll(tenantId, id, dto, user.id);
    return withAudit(payroll, {
      tenantId,
      entity: 'user_payroll',
      entityId: String(payroll._id),
      action: 'create',
      after: payroll,
      by: user.id
    });
  }

  @Patch(':id/payroll/:payrollId')
  @Permissions('finance.write')
  async updatePayroll(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Param('payrollId') payrollId: string,
    @Body() dto: UpdateUserPayrollDto
  ) {
    const before = await this.usersService.getPayroll(tenantId, id, payrollId);
    const updated = await this.usersService.updatePayroll(tenantId, id, payrollId, dto, user.id);
    return withAudit(updated, {
      tenantId,
      entity: 'user_payroll',
      entityId: payrollId,
      action: 'update',
      before,
      after: updated,
      by: user.id
    });
  }

  @Patch(':id')
  @Permissions('users.write')
  async update(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto
  ) {
    const beforeDoc = await this.usersService.findById(tenantId, id);
    const updated = await this.usersService.update(tenantId, id, dto, user.id);
    const before = beforeDoc ? this.usersService.sanitize(beforeDoc) : null;
    return withAudit(updated, {
      tenantId,
      entity: 'users',
      entityId: id,
      action: 'update',
      before,
      after: updated,
      by: user.id
    });
  }
}



