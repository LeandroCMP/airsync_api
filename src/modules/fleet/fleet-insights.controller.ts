import { Body, Controller, Post } from '@nestjs/common';
import { FleetInsightsService } from './fleet-insights.service';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { FleetChatDto } from './dto/fleet-chat.dto';

@Controller('fleet/insights')
export class FleetInsightsController {
  constructor(private readonly fleetInsights: FleetInsightsService) {}

  @Post('recommendations')
  @Permissions('fleet.read')
  async recommendations(@TenantId() tenantId: string) {
    return this.fleetInsights.maintenanceRecommendations(tenantId);
  }

  @Post('chat')
  @Permissions('fleet.read')
  async chat(@TenantId() tenantId: string, @Body() dto: FleetChatDto) {
    return this.fleetInsights.chat(tenantId, dto.question);
  }
}

