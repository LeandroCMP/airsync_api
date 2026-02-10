import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CrmService } from './crm.service';
import { CreateTimelineDto } from './dto/create-timeline.dto';
import { SubmitNpsDto } from './dto/submit-nps.dto';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { withAudit } from '../../common/utils/audit.util';
import { Public } from '../../common/decorators/public.decorator';

@Controller('crm')
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  @Post('timeline')
  @Permissions('crm.write')
  async addTimeline(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateTimelineDto
  ) {
    const entry = await this.crmService.addEntry(tenantId, dto, user.id);
    return withAudit(entry, {
      tenantId,
      entity: 'crm_timeline',
      entityId: entry._id,
      action: 'create',
      after: entry,
      by: user.id
    });
  }

  @Get('timeline/:clientId')
  @Permissions('crm.read')
  async listTimeline(@TenantId() tenantId: string, @Param('clientId') clientId: string) {
    return this.crmService.listTimeline(tenantId, clientId);
  }

  @Post('nps/submit')
  @Public()
  async submitNps(@Body() dto: SubmitNpsDto) {
    const entry = await this.crmService.submitNps(dto.tenantId, dto);
    return withAudit(entry, {
      tenantId: dto.tenantId,
      entity: 'crm_timeline',
      entityId: entry._id,
      action: 'create',
      after: entry,
      by: dto.clientId
    });
  }
}
