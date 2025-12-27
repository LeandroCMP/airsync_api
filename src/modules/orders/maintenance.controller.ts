import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { MaintenanceService } from './maintenance.service';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CreateServiceTypeDto, UpdateServiceTypeDto } from './dto/create-service-type.dto';
import { MaintenanceReminderStatus } from './maintenance-reminder.schema';

@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Get('service-types')
  @Permissions('orders.read')
  async listTypes(@TenantId() tenantId: string) {
    return this.maintenanceService.listServiceTypes(tenantId);
  }

  @Post('service-types')
  @Permissions('orders.write')
  async createType(@TenantId() tenantId: string, @Body() dto: CreateServiceTypeDto) {
    return this.maintenanceService.createServiceType(tenantId, dto);
  }

  @Patch('service-types/:code')
  @Permissions('orders.write')
  async updateType(
    @TenantId() tenantId: string,
    @Param('code') code: string,
    @Body() dto: UpdateServiceTypeDto
  ) {
    return this.maintenanceService.updateServiceType(tenantId, code, dto);
  }

  @Get('reminders')
  @Permissions('orders.read')
  async listReminders(
    @TenantId() tenantId: string,
    @Query('equipmentId') equipmentId?: string,
    @Query('status') status?: MaintenanceReminderStatus,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    return this.maintenanceService.listReminders(tenantId, { equipmentId, status, from, to });
  }
}
