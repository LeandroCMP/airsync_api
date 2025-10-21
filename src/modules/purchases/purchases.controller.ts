import { Body, Controller, Param, Patch, Post } from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { ReceivePurchaseDto } from './dto/receive-purchase.dto';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { withAudit } from '../../common/utils/audit.util';

@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Post()
  @Permissions('inventory.write')
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: CreatePurchaseDto
  ) {
    const purchase = await this.purchasesService.create(tenantId, dto, user.id);
    return withAudit(purchase, {
      tenantId,
      entity: 'purchases',
      entityId: purchase._id,
      action: 'create',
      after: purchase,
      by: user.id
    });
  }

  @Patch(':id/receive')
  @Permissions('inventory.write')
  async receive(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: ReceivePurchaseDto
  ) {
    const before = await this.purchasesService.findById(tenantId, id);
    const purchase = await this.purchasesService.receive(tenantId, id, dto, user.id);
    return withAudit(purchase, {
      tenantId,
      entity: 'purchases',
      entityId: id,
      action: 'update',
      before: before.toObject(),
      after: purchase,
      by: user.id
    });
  }
}
