import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateInventoryItemDto } from './dto/create-item.dto';
import { UpdateInventoryItemDto } from './dto/update-item.dto';
import { CreateInventoryMovementDto } from './dto/create-movement.dto';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { withAudit } from '../../common/utils/audit.util';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('items')
  @Permissions('inventory.write')
  async createItem(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateInventoryItemDto
  ) {
    const item = await this.inventoryService.createItem(tenantId, dto, user.id);
    return withAudit(item, {
      tenantId,
      entity: 'inventory_items',
      entityId: item._id,
      action: 'create',
      after: item,
      by: user.id
    });
  }

  @Get('items')
  @Permissions('inventory.read')
  async search(@TenantId() tenantId: string, @Query('text') text?: string) {
    return this.inventoryService.search(tenantId, text);
  }

  @Patch('items/:id')
  @Permissions('inventory.write')
  async update(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateInventoryItemDto
  ) {
    const before = await this.inventoryService.findById(tenantId, id);
    const updated = await this.inventoryService.updateItem(tenantId, id, dto, user.id);
    return withAudit(updated, {
      tenantId,
      entity: 'inventory_items',
      entityId: id,
      action: 'update',
      before: before.toObject(),
      after: updated,
      by: user.id
    });
  }

  @Post('movements')
  @Permissions('inventory.write')
  async movement(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateInventoryMovementDto
  ) {
    const updated = await this.inventoryService.recordMovement(tenantId, dto, user.id);
    return withAudit(updated, {
      tenantId,
      entity: 'inventory_items',
      entityId: dto.itemId,
      action: 'update',
      after: updated,
      by: user.id
    });
  }

  @Get('low-stock')
  @Permissions('inventory.read')
  async lowStock(@TenantId() tenantId: string) {
    return this.inventoryService.lowStock(tenantId);
  }
}
