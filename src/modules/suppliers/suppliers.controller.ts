import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { withAudit } from '../../common/utils/audit.util';

@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  @Permissions('inventory.write')
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateSupplierDto
  ) {
    const supplier = await this.suppliersService.create(tenantId, dto, user.id);
    return withAudit(supplier, {
      tenantId,
      entity: 'suppliers',
      entityId: supplier._id,
      action: 'create',
      after: supplier,
      by: user.id
    });
  }

  @Get()
  @Permissions('inventory.read')
  async search(@TenantId() tenantId: string, @Query('text') text?: string) {
    return this.suppliersService.search(tenantId, text);
  }

  @Patch(':id')
  @Permissions('inventory.write')
  async update(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto
  ) {
    const updated = await this.suppliersService.update(tenantId, id, dto, user.id);
    return withAudit(updated, {
      tenantId,
      entity: 'suppliers',
      entityId: id,
      action: 'update',
      after: updated,
      by: user.id
    });
  }
}
