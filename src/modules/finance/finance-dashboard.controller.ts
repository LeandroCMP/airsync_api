import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { AllocateIndirectCostsDto } from './dto/allocate-indirect-costs.dto';

@Controller('finance')
export class FinanceDashboardController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('dashboard')
  @Permissions('finance.read')
  async dashboard(
    @TenantId() tenantId: string,
    @Query('month') month?: string,
    @Query('costCenterId') costCenterId?: string
  ) {
    return this.financeService.dashboard(tenantId, month, costCenterId);
  }

  @Get('audit')
  @Permissions('finance.read')
  async audit(@TenantId() tenantId: string) {
    return this.financeService.audit(tenantId);
  }

  @Get('forecast')
  @Permissions('finance.read')
  async forecast(@TenantId() tenantId: string, @Query('days') days?: string) {
    return this.financeService.forecast(tenantId, Number(days));
  }

  @Post('allocations/indirect')
  @Permissions('finance.write')
  async allocateIndirect(
    @TenantId() tenantId: string,
    @Body() dto: AllocateIndirectCostsDto
  ) {
    return this.financeService.allocateIndirectCosts(tenantId, dto);
  }

  @Get('reconciliation/payments')
  @Permissions('finance.read')
  async reconcilePayments(
    @TenantId() tenantId: string,
    @Query('scope') scope?: 'orders' | 'purchases' | 'all'
  ) {
    return this.financeService.reconcilePayments(tenantId, scope || 'all');
  }

  @Get('reconciliation/report')
  @Permissions('finance.read')
  async reconciliationReport(
    @TenantId() tenantId: string,
    @Query('scope') scope?: 'orders' | 'purchases' | 'all'
  ) {
    return this.financeService.reconcilePaymentsReport(tenantId, scope || 'all');
  }
}
