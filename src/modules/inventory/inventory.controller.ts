import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateInventoryItemDto } from './dto/create-item.dto';
import { UpdateInventoryItemDto } from './dto/update-item.dto';
import { CreateInventoryMovementDto } from './dto/create-movement.dto';
import { SearchInventoryItemsDto } from './dto/search-items.dto';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { withAudit } from '../../common/utils/audit.util';
import { ApiBadRequestResponse, ApiForbiddenResponse, ApiOperation } from '@nestjs/swagger';
import { ErrorResponseDto } from '../../common/dto/error-response.dto';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('items')
  @Permissions('inventory.write')
  @ApiOperation({ summary: 'Criar item de estoque' })
  @ApiBadRequestResponse({ description: 'Erro de validação', type: ErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Sem permissão', type: ErrorResponseDto })
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
  @ApiOperation({ summary: 'Listar itens de estoque' })
  @ApiForbiddenResponse({ description: 'Sem permissão', type: ErrorResponseDto })
  async search(@TenantId() tenantId: string, @Query() query: SearchInventoryItemsDto) {
    return this.inventoryService.search(tenantId, query);
  }

  @Patch('items/:id')
  @Permissions('inventory.write')
  @ApiOperation({ summary: 'Atualizar item de estoque' })
  @ApiBadRequestResponse({ description: 'Erro de validação', type: ErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Sem permissão', type: ErrorResponseDto })
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
  @ApiOperation({ summary: 'Registrar movimentação de estoque' })
  @ApiBadRequestResponse({ description: 'Erro de validação ou regra de estoque', type: ErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Sem permissão', type: ErrorResponseDto })
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
  @ApiOperation({ summary: 'Listar itens com baixo estoque' })
  @ApiForbiddenResponse({ description: 'Sem permissão', type: ErrorResponseDto })
  async lowStock(@TenantId() tenantId: string) {
    return this.inventoryService.lowStock(tenantId);
  }

  @Delete('items/:id')
  @Permissions('inventory.write')
  @ApiOperation({ summary: 'Excluir item de estoque (soft delete)' })
  @ApiBadRequestResponse({ description: 'Bloqueios: saldo ou reserva pendente', type: ErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Sem permissão', type: ErrorResponseDto })
  async removeItem(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string
  ) {
    const before = await this.inventoryService.findById(tenantId, id);
    const removed = await this.inventoryService.removeItem(tenantId, id, user.id);
    return withAudit({ success: true }, {
      tenantId,
      entity: 'inventory_items',
      entityId: id,
      action: 'delete',
      before: before.toObject(),
      after: removed,
      by: user.id
    });
  }
}
