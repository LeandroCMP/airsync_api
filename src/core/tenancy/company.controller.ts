import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { UpdateTenantProfileDto } from './dto/update-tenant-profile.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { withAudit } from '../../common/utils/audit.util';

@Controller('company')
export class CompanyController {
  constructor(private readonly tenantService: TenantService) {}

  @Get('profile')
  @Permissions('users.write')
  async getProfile(@TenantId() tenantId: string) {
    const tenant = await this.tenantService.findById(tenantId);
    return tenant;
  }

  @Put('profile')
  @Permissions('users.write')
  async updateProfile(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateTenantProfileDto
  ) {
    const before = await this.tenantService.findById(tenantId);
    const updated = await this.tenantService.updateProfile(tenantId, dto);
    return withAudit(updated, {
      tenantId,
      entity: 'tenant',
      entityId: tenantId,
      action: 'update',
      before,
      after: updated,
      by: user.id
    });
  }

  @Get('profile/export')
  @Permissions('users.write')
  async exportProfile(@TenantId() tenantId: string) {
    const profile = await this.tenantService.findById(tenantId);
    return {
      exportedAt: new Date(),
      profile
    };
  }

  @Post('profile/import')
  @Permissions('users.write')
  async importProfile(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body('profile') profile: UpdateTenantProfileDto
  ) {
    const before = await this.tenantService.findById(tenantId);
    const updated = await this.tenantService.updateProfile(tenantId, profile || {});
    return withAudit(updated, {
      tenantId,
      entity: 'tenant',
      entityId: tenantId,
      action: 'update',
      before,
      after: updated,
      by: user.id
    });
  }
}
