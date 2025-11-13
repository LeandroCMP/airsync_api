import { Body, Controller, Param, Post } from '@nestjs/common';
import { OrdersInsightsService } from './orders-insights.service';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { OrderAssistantDto } from './dto/order-assistant.dto';

@Controller('orders')
export class OrdersInsightsController {
  constructor(private readonly insightsService: OrdersInsightsService) {}

  @Post(':id/insights/assistant')
  @Permissions('orders.read')
  async assistant(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: OrderAssistantDto
  ) {
    return this.insightsService.assistant(tenantId, id, dto.question);
  }

  @Post(':id/insights/summary')
  @Permissions('orders.read')
  async summary(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.insightsService.clientSummary(tenantId, id);
  }
}
