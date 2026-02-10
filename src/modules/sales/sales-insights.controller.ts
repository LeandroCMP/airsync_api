import { Body, Controller, Param, Post } from '@nestjs/common';
import { SalesInsightsService } from './sales-insights.service';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { SalesChatDto } from './dto/sales-chat.dto';

@Controller('sales')
export class SalesInsightsController {
  constructor(private readonly insightsService: SalesInsightsService) {}

  @Post(':id/insights/proposal')
  @Permissions('sales.read')
  async proposal(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.insightsService.proposal(tenantId, id);
  }

  @Post(':id/insights/chat')
  @Permissions('sales.read')
  async chat(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: SalesChatDto
  ) {
    return this.insightsService.chat(tenantId, id, dto.question);
  }
}
