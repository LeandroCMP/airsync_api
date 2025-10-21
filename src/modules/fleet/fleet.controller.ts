import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { FleetService } from './fleet.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { VehicleCheckDto } from './dto/vehicle-check.dto';
import { VehicleFuelDto } from './dto/vehicle-fuel.dto';
import { VehicleMaintenanceDto } from './dto/vehicle-maintenance.dto';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { withAudit } from '../../common/utils/audit.util';

@Controller('fleet/vehicles')
export class FleetController {
  constructor(private readonly fleetService: FleetService) {}

  @Post()
  @Permissions('fleet.write')
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateVehicleDto
  ) {
    const vehicle = await this.fleetService.create(tenantId, dto, user.id);
    return withAudit(vehicle, {
      tenantId,
      entity: 'fleet_vehicles',
      entityId: vehicle._id,
      action: 'create',
      after: vehicle,
      by: user.id
    });
  }

  @Get()
  @Permissions('fleet.read')
  async list(@TenantId() tenantId: string) {
    return this.fleetService.list(tenantId);
  }

  @Post(':id/check')
  @Permissions('fleet.write')
  async check(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: VehicleCheckDto
  ) {
    const vehicle = await this.fleetService.addCheck(tenantId, id, dto);
    return withAudit(vehicle, {
      tenantId,
      entity: 'fleet_vehicles',
      entityId: id,
      action: 'update',
      after: vehicle,
      by: user.id
    });
  }

  @Post(':id/fuel')
  @Permissions('fleet.write')
  async fuel(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: VehicleFuelDto
  ) {
    const vehicle = await this.fleetService.addFuel(tenantId, id, dto);
    return withAudit(vehicle, {
      tenantId,
      entity: 'fleet_vehicles',
      entityId: id,
      action: 'update',
      after: vehicle,
      by: user.id
    });
  }

  @Post(':id/maintenance')
  @Permissions('fleet.write')
  async maintenance(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: VehicleMaintenanceDto
  ) {
    const vehicle = await this.fleetService.addMaintenance(tenantId, id, dto);
    return withAudit(vehicle, {
      tenantId,
      entity: 'fleet_vehicles',
      entityId: id,
      action: 'update',
      after: vehicle,
      by: user.id
    });
  }
}
