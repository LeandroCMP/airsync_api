import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { EquipmentService } from './equipment.service';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { withAudit } from '../../common/utils/audit.util';

@Controller('equipment')
export class EquipmentController {
  constructor(private readonly equipmentService: EquipmentService) {}

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
}
