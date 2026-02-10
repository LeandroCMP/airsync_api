import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { CreateFinanceTransactionDto } from './dto/create-transaction.dto';
import { PayTransactionDto } from './dto/pay-transaction.dto';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { withAudit } from '../../common/utils/audit.util';

@Controller('finance/transactions')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Post()
  @Permissions('finance.write')
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateFinanceTransactionDto
  ) {
    const tx = await this.financeService.create(tenantId, dto, user.id);
    return withAudit(tx, {
      tenantId,
      entity: 'finance_transactions',
      entityId: tx._id,
      action: 'create',
      after: tx,
      by: user.id
    });
  }

  @Get()
  @Permissions('finance.read')
  async list(
    @TenantId() tenantId: string,
    @Query('type') type?: string,
    @Query('paid') paid?: string,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    return this.financeService.list(tenantId, { type, paid, from, to });
  }

  @Patch(':id/pay')
  @Permissions('finance.write')
  async pay(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: PayTransactionDto
  ) {
    const before = await this.financeService.findById(tenantId, id);
    const paidTx = await this.financeService.pay(tenantId, id, dto, user.id);
    return withAudit(paidTx, {
      tenantId,
      entity: 'finance_transactions',
      entityId: id,
      action: 'update',
      before: before.toObject(),
      after: paidTx,
      by: user.id
    });
  }
}
