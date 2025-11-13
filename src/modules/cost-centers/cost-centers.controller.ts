import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CostCentersService } from './cost-centers.service';
import { CreateCostCenterDto } from './dto/create-cost-center.dto';
import { UpdateCostCenterDto } from './dto/update-cost-center.dto';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { withAudit } from '../../common/utils/audit.util';

@Controller('cost-centers')
export class CostCentersController {
  constructor(private readonly costCentersService: CostCentersService) {}

  @Post()
  @Permissions('finance.write')
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateCostCenterDto
  ) {
    const center = await this.costCentersService.create(tenantId, dto);
    return withAudit(center, {
      tenantId,
      entity: 'cost_centers',
      entityId: center._id,
      action: 'create',
      after: center,
      by: user.id
    });
  }

  @Get()
  @Permissions('finance.read')
  async list(
    @TenantId() tenantId: string,
    @Query('active') active?: string
  ) {
    return this.costCentersService.list(tenantId, active === 'true');
  }

  @Get(':id')
  @Permissions('finance.read')
  async findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    const center = await this.costCentersService.findById(tenantId, id);
    return center.toObject();
  }

  @Patch(':id')
  @Permissions('finance.write')
  async update(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateCostCenterDto
  ) {
    const updated = await this.costCentersService.update(tenantId, id, dto);
    return withAudit(updated, {
      tenantId,
      entity: 'cost_centers',
      entityId: id,
      action: 'update',
      after: updated,
      by: user.id
    });
  }

  @Delete(':id')
  @Permissions('finance.write')
  async remove(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string
  ) {
    await this.costCentersService.remove(tenantId, id);
    return withAudit({ deleted: true }, {
      tenantId,
      entity: 'cost_centers',
      entityId: id,
      action: 'delete',
      after: { deleted: true },
      by: user.id
    });
  }
}

