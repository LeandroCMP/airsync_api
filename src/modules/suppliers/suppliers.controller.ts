import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { withAudit } from '../../common/utils/audit.util';
import { ApiBadRequestResponse, ApiForbiddenResponse, ApiOperation } from '@nestjs/swagger';
import { ErrorResponseDto } from '../../common/dto/error-response.dto';

@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  @Permissions('inventory.write')
  @ApiOperation({ summary: 'Criar fornecedor' })
  @ApiBadRequestResponse({ description: 'Erro de validação', type: ErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Sem permissão', type: ErrorResponseDto })
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
  @ApiOperation({ summary: 'Listar/Buscar fornecedores' })
  @ApiForbiddenResponse({ description: 'Sem permissão', type: ErrorResponseDto })
  async search(@TenantId() tenantId: string, @Query('text') text?: string) {
    return this.suppliersService.search(tenantId, text);
  }

  @Patch(':id')
  @Permissions('inventory.write')
  @ApiOperation({ summary: 'Atualizar fornecedor' })
  @ApiBadRequestResponse({ description: 'Erro de validação', type: ErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Sem permissão', type: ErrorResponseDto })
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

  @Delete(':id')
  @Permissions('inventory.write')
  @ApiOperation({ summary: 'Excluir fornecedor (soft delete)' })
  @ApiForbiddenResponse({ description: 'Sem permissão', type: ErrorResponseDto })
  async remove(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string
  ) {
    const before = await this.suppliersService.findById(tenantId, id);
    const removed = await this.suppliersService.remove(tenantId, id, user.id);
    return withAudit({ success: true }, {
      tenantId,
      entity: 'suppliers',
      entityId: id,
      action: 'delete',
      before: before.toObject(),
      after: removed,
      by: user.id
    });
  }
}
