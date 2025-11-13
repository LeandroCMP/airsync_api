import { Controller, Post, Query } from '@nestjs/common';
import { FinanceInsightsService } from './finance-insights.service';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';

@Controller('finance/insights')
export class FinanceInsightsController {
  constructor(private readonly insightsService: FinanceInsightsService) {}

  @Post('anomalies')
  @Permissions('finance.read')
  async anomalies(@TenantId() tenantId: string, @Query('month') month?: string) {
    return this.insightsService.anomalies(tenantId, month);
  }
}

