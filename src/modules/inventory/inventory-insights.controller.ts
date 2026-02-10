import { Controller, Post } from '@nestjs/common';
import { InventoryInsightsService } from './inventory-insights.service';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';

@Controller('inventory/insights')
export class InventoryInsightsController {
  constructor(private readonly insightsService: InventoryInsightsService) {}

  @Post('forecast')
  @Permissions('inventory.read')
  async forecast(@TenantId() tenantId: string) {
    return this.insightsService.forecast(tenantId);
  }
}

