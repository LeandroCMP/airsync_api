import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { EquipmentService } from './equipment.service';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { withAudit } from '../../common/utils/audit.util';
import { EquipmentHistoryService } from '../equipment-history/equipment-history.service';
import { MoveEquipmentDto } from './dto/move-equipment.dto';
import { ReplaceEquipmentDto } from './dto/replace-equipment.dto';
import { PdfService } from '../../pdf/pdf.service';
import { OrdersService } from '../orders/orders.service';

@Controller('equipment')
export class EquipmentController {
  constructor(
    private readonly equipmentService: EquipmentService,
    private readonly historyService: EquipmentHistoryService,
    private readonly ordersService: OrdersService,
    private readonly pdfService: PdfService
  ) {}

  @Post()
  @Permissions('clients.write')
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateEquipmentDto
  ) {
    const equipment = await this.equipmentService.create(tenantId, dto, user.id);
    return withAudit(equipment, {
      tenantId,
      entity: 'equipment',
      entityId: equipment._id,
      action: 'create',
      after: equipment,
      by: user.id
    });
  }

  @Get()
  async findAll(
    @TenantId() tenantId: string,
    @Query('clientId') clientId?: string,
    @Query('locationId') locationId?: string
  ) {
    return this.equipmentService.findAll(tenantId, { clientId, locationId });
  }

  @Patch(':id')
  @Permissions('clients.write')
  async update(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateEquipmentDto
  ) {
    const before = await this.equipmentService.findById(tenantId, id);
    const updated = await this.equipmentService.update(tenantId, id, dto, user.id);
    return withAudit(updated, {
      tenantId,
      entity: 'equipment',
      entityId: id,
      action: 'update',
      before: before.toObject(),
      after: updated,
      by: user.id
    });
  }

  @Get(':id/history')
  async history(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.historyService.listByEquipment(tenantId, id);
  }

  @Post(':id/move')
  @Permissions('clients.write')
  async move(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: MoveEquipmentDto
  ) {
    const before = await this.equipmentService.findById(tenantId, id);
    const moved = await this.equipmentService.move(tenantId, id, dto, user.id);
    return withAudit(moved, {
      tenantId,
      entity: 'equipment',
      entityId: id,
      action: 'update',
      before: before.toObject(),
      after: moved,
      by: user.id
    });
  }

  @Post(':id/replace')
  @Permissions('clients.write')
  async replace(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: ReplaceEquipmentDto
  ) {
    const before = await this.equipmentService.findById(tenantId, id);
    const created = await this.equipmentService.replace(tenantId, id, dto, user.id);
    return withAudit(created, {
      tenantId,
      entity: 'equipment',
      entityId: id,
      action: 'update',
      before: before.toObject(),
      after: created,
      by: user.id
    });
  }

  @Get(':id/report')
  async report(@TenantId() tenantId: string, @Param('id') id: string, @Query('newOwner') newOwner?: string) {
    const equipment = await this.equipmentService.findById(tenantId, id);
    const history = await this.historyService.listByEquipment(tenantId, id);
    const orders = await this.ordersService.listByEquipment(tenantId, id);
    return this.pdfService.generateEquipmentHistoryPdf(equipment.toObject(), orders, history, newOwner);
  }

  @Delete(':id')
  @Permissions('clients.write')
  async remove(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string
  ) {
    const before = await this.equipmentService.findById(tenantId, id);
    const removed = await this.equipmentService.remove(tenantId, id, user.id);
    return withAudit({ success: true }, {
      tenantId,
      entity: 'equipment',
      entityId: id,
      action: 'delete',
      before: before.toObject(),
      after: removed,
      by: user.id
    });
  }
}
