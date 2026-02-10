import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { withAudit } from '../../common/utils/audit.util';

@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  @Permissions('sales.write')
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateSaleDto
  ) {
    const sale = await this.salesService.create(tenantId, dto, user.id);
    return withAudit(sale, {
      tenantId,
      entity: 'sales',
      entityId: sale._id,
      action: 'create',
      after: sale,
      by: user.id
    });
  }

  @Get()
  @Permissions('sales.read')
  async list(
    @TenantId() tenantId: string,
    @Query('status') status?: string,
    @Query('clientId') clientId?: string,
    @Query('locationId') locationId?: string
  ) {
    return this.salesService.list(tenantId, { status, clientId, locationId });
  }

  @Get(':id')
  @Permissions('sales.read')
  async findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    const sale = await this.salesService.findById(tenantId, id);
    return sale.toObject ? sale.toObject() : sale;
  }

  @Patch(':id')
  @Permissions('sales.write')
  async update(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateSaleDto
  ) {
    const before = await this.salesService.findById(tenantId, id);
    const updated = await this.salesService.update(tenantId, id, dto, user.id);
    return withAudit(updated, {
      tenantId,
      entity: 'sales',
      entityId: id,
      action: 'update',
      before: before.toObject(),
      after: updated,
      by: user.id
    });
  }

  @Patch(':id/approve')
  @Permissions('sales.write')
  async approve(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string
  ) {
    const before = await this.salesService.findById(tenantId, id);
    const approved = await this.salesService.approve(tenantId, id, user.id);
    return withAudit(approved, {
      tenantId,
      entity: 'sales',
      entityId: id,
      action: 'update',
      before: before.toObject(),
      after: approved,
      by: user.id
    });
  }

  @Patch(':id/fulfill')
  @Permissions('sales.write')
  async fulfill(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string
  ) {
    const before = await this.salesService.findById(tenantId, id);
    const fulfilled = await this.salesService.fulfill(tenantId, id, user.id);
    return withAudit(fulfilled, {
      tenantId,
      entity: 'sales',
      entityId: id,
      action: 'update',
      before: before.toObject(),
      after: fulfilled,
      by: user.id
    });
  }

  @Patch(':id/cancel')
  @Permissions('sales.write')
  async cancel(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string
  ) {
    const before = await this.salesService.findById(tenantId, id);
    const canceled = await this.salesService.cancel(tenantId, id, user.id);
    return withAudit(canceled, {
      tenantId,
      entity: 'sales',
      entityId: id,
      action: 'update',
      before: before.toObject(),
      after: canceled,
      by: user.id
    });
  }
}

