import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';

@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Get('onboard')
  @Roles('owner')
  async onboard(@TenantId() tenantId: string) {
    return this.whatsappService.buildOnboardingUrl(tenantId);
  }

  @Get('status')
  @Roles('owner')
  async status(@TenantId() tenantId: string) {
    return this.whatsappService.getStatus(tenantId);
  }

  @Get('callback')
  @Public()
  async callback(@Query('code') code?: string, @Query('state') state?: string, @Query('error') error?: string) {
    if (error) {
      throw new BadRequestException({
        code: 'WHATSAPP_OAUTH_ERROR',
        message: `Whatsapp retornou erro: ${error}`
      });
    }
    return this.whatsappService.handleCallback(code || '', state);
  }
}
