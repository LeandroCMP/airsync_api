import { Controller, Get, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dre')
  @Permissions('finance.read')
  async dre(
    @TenantId() tenantId: string,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    return this.reportsService.dre(tenantId, from, to);
  }

  @Get('kpis')
  @Permissions('orders.read')
  async kpis(@TenantId() tenantId: string, @Query('month') month?: string) {
    return this.reportsService.kpis(tenantId, month);
  }

  @Get('fleet/costs')
  @Permissions('fleet.read')
  async fleetCosts(
    @TenantId() tenantId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('by') by: 'km' | 'vehicle' = 'vehicle'
  ) {
    return this.reportsService.fleetCosts(tenantId, from, to, by);
  }
}
