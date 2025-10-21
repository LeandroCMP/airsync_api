import { Controller, Get, Query } from '@nestjs/common';
import { SyncService } from './sync.service';
import { TenantId } from '../common/decorators/tenant.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Get('changes')
  @Permissions('sync.read')
  async getChanges(
    @TenantId() tenantId: string,
    @Query('scope') scope: string,
    @Query('since') since: string,
    @Query('includeDeleted') includeDeleted?: string
  ) {
    const scopes = scope ? scope.split(',') : [];
    const sinceDate = since ? new Date(since) : new Date(0);
    const result = await this.syncService.getChanges(
      tenantId,
      scopes,
      sinceDate,
      includeDeleted === 'true'
    );
    return { since: sinceDate.toISOString(), data: result };
  }
}
