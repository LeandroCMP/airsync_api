import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { withAudit } from '../../common/utils/audit.util';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  @Permissions('clients.write')
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateClientDto
  ) {
    const client = await this.clientsService.create(tenantId, dto, user.id);
    return withAudit(client, {
      tenantId,
      entity: 'clients',
      entityId: client._id,
      action: 'create',
      after: client,
      by: user.id
    });
  }

  @Get()
  async search(
    @TenantId() tenantId: string,
    @Query('text') text?: string,
    @Query('limit') limit = 20
  ) {
    return this.clientsService.search(tenantId, text, Number(limit));
  }

  @Get(':id')
  async findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    const client = await this.clientsService.findById(tenantId, id);
    return client.toObject();
  }

  @Patch(':id')
  @Permissions('clients.write')
  async update(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateClientDto
  ) {
    const before = await this.clientsService.findById(tenantId, id);
    const updated = await this.clientsService.update(tenantId, id, dto, user.id);
    return withAudit(updated, {
      tenantId,
      entity: 'clients',
      entityId: id,
      action: 'update',
      before: before.toObject(),
      after: updated,
      by: user.id
    });
  }

  @Delete(':id')
  @Permissions('clients.write')
  async remove(@TenantId() tenantId: string, @CurrentUser() user: any, @Param('id') id: string) {
    const before = await this.clientsService.findById(tenantId, id);
    const removed = await this.clientsService.remove(tenantId, id, user.id);
    return withAudit({ success: true }, {
      tenantId,
      entity: 'clients',
      entityId: id,
      action: 'delete',
      before: before.toObject(),
      after: removed,
      by: user.id
    });
  }
}
