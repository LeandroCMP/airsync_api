import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { InventoryCategoriesService } from './inventory-categories.service';
import { CreateInventoryCategoryDto } from './dto/create-category.dto';
import { UpdateInventoryCategoryDto } from './dto/update-category.dto';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { withAudit } from '../../common/utils/audit.util';

@Controller('inventory/categories')
export class InventoryCategoriesController {
  constructor(private readonly categoriesService: InventoryCategoriesService) {}

  @Post()
  @Permissions('inventory.write')
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateInventoryCategoryDto
  ) {
    const category = await this.categoriesService.create(tenantId, dto);
    return withAudit(category, {
      tenantId,
      entity: 'inventory_categories',
      entityId: category._id,
      action: 'create',
      after: category,
      by: user.id
    });
  }

  @Get()
  @Permissions('inventory.read')
  async list(@TenantId() tenantId: string) {
    return this.categoriesService.list(tenantId);
  }

  @Patch(':id')
  @Permissions('inventory.write')
  async update(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateInventoryCategoryDto
  ) {
    const updated = await this.categoriesService.update(tenantId, id, dto);
    return withAudit(updated, {
      tenantId,
      entity: 'inventory_categories',
      entityId: id,
      action: 'update',
      after: updated,
      by: user.id
    });
  }

  @Delete(':id')
  @Permissions('inventory.write')
  async remove(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string
  ) {
    await this.categoriesService.remove(tenantId, id);
    return withAudit({ deleted: true }, {
      tenantId,
      entity: 'inventory_categories',
      entityId: id,
      action: 'delete',
      after: { deleted: true },
      by: user.id
    });
  }
}

