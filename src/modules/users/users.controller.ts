import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
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

  @Get()
  async findAll(@TenantId() tenantId: string, @Query('role') role?: string) {
    return this.usersService.findAll(tenantId, role);
  }

  @Patch(':id')
  @Permissions('users.write')
  async update(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto
  ) {
    const before = await this.usersService.findById(tenantId, id);
    const updated = await this.usersService.update(tenantId, id, dto, user.id);
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
