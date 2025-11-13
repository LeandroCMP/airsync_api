import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { PayInvoiceDto } from './dto/pay-invoice.dto';
import { NegotiateInvoiceDto } from './dto/negotiate-invoice.dto';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('current')
  @Roles('owner')
  async getCurrent(@TenantId() tenantId: string) {
    return this.subscriptionsService.getCurrent(tenantId);
  }

  @Patch('current')
  @Roles('owner')
  async updateCurrent(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateSubscriptionDto
  ) {
    const data = await this.subscriptionsService.updateCurrent(tenantId, dto);
    return {
      ...data,
      updatedBy: user.id
    };
  }

  @Get('invoices')
  @Roles('owner')
  async listInvoices(
    @TenantId() tenantId: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    return this.subscriptionsService.listInvoices(tenantId, { status: status as any, from, to });
  }

  @Post('invoices/:id/pay')
  @Roles('owner')
  async payInvoice(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: PayInvoiceDto
  ) {
    const invoice = await this.subscriptionsService.recordPayment(tenantId, id, dto, user.id);
    return invoice;
  }

  @Post('invoices/:id/negotiate')
  @Roles('owner')
  async negotiate(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: NegotiateInvoiceDto
  ) {
    return this.subscriptionsService.negotiateInvoice(tenantId, id, dto, user.id);
  }

  @Get('alerts')
  @Roles('owner')
  async alerts(@TenantId() tenantId: string) {
    return this.subscriptionsService.getAlerts(tenantId);
  }
}

