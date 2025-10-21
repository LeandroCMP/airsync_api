import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { ScheduleNextDto } from './dto/schedule-next.dto';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { withAudit } from '../../common/utils/audit.util';

@Controller('contracts')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Post()
  @Permissions('contracts.write')
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateContractDto
  ) {
    const contract = await this.contractsService.create(tenantId, dto, user.id);
    return withAudit(contract, {
      tenantId,
      entity: 'contracts',
      entityId: contract._id,
      action: 'create',
      after: contract,
      by: user.id
    });
  }

  @Get()
  @Permissions('contracts.read')
  async list(
    @TenantId() tenantId: string,
    @Query('status') status?: string,
    @Query('clientId') clientId?: string
  ) {
    return this.contractsService.list(tenantId, { status, clientId });
  }

  @Post(':id/schedule-next')
  @Permissions('contracts.write')
  async scheduleNext(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: ScheduleNextDto
  ) {
    const contract = await this.contractsService.scheduleNext(tenantId, id, dto, user.id);
    return withAudit(contract, {
      tenantId,
      entity: 'contracts',
      entityId: id,
      action: 'update',
      after: contract,
      by: user.id
    });
  }
}
