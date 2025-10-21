import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { withAudit } from '../../common/utils/audit.util';

@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Post()
  @Permissions('clients.write')
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateLocationDto
  ) {
    const location = await this.locationsService.create(tenantId, dto, user.id);
    return withAudit(location, {
      tenantId,
      entity: 'locations',
      entityId: location._id,
      action: 'create',
      after: location,
      by: user.id
    });
  }

  @Get()
  async findAll(@TenantId() tenantId: string, @Query('clientId') clientId?: string) {
    return this.locationsService.findAll(tenantId, clientId);
  }

  @Patch(':id')
  @Permissions('clients.write')
  async update(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateLocationDto
  ) {
    const before = await this.locationsService.findById(tenantId, id);
    const updated = await this.locationsService.update(tenantId, id, dto, user.id);
    return withAudit(updated, {
      tenantId,
      entity: 'locations',
      entityId: id,
      action: 'update',
      before: before.toObject(),
      after: updated,
      by: user.id
    });
  }
}
