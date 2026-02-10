import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { RescheduleOrderDto } from './dto/reschedule-order.dto';
import { OrderMaterialsDto } from './dto/order-materials.dto';
import { FinishOrderDto } from './dto/finish-order.dto';
import { CreateOrderPurchaseDto } from './dto/create-order-purchase.dto';
import { TenantId } from '../../common/decorators/tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { withAudit } from '../../common/utils/audit.util';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @Permissions('orders.write')
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateOrderDto
  ) {
    const order = await this.ordersService.create(tenantId, dto, user.id);
    return withAudit(order, {
      tenantId,
      entity: 'orders',
      entityId: order._id,
      action: 'create',
      after: order,
      by: user.id
    });
  }

  @Get()
  @Permissions('orders.read')
  async list(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('tech') tech?: string
  ) {
    return this.ordersService.list(tenantId, { status, from, to, tech }, user);
  }

  @Get(':id/costs')
  @Permissions('orders.read')
  async costs(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string
  ) {
    return this.ordersService.getCostSummary(tenantId, id, user);
  }

  @Get(':id')
  @Permissions('orders.read')
  async findOne(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string
  ) {
    const order = await this.ordersService.findById(tenantId, id);
    this.ordersService.ensureCanView(order, user);
    return order.toObject();
  }

  @Patch(':id')
  @Permissions('orders.write')
  async update(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateOrderDto
  ) {
    const before = await this.ordersService.findById(tenantId, id);
    const updated = await this.ordersService.update(tenantId, id, dto, user.id);
    return withAudit(updated, {
      tenantId,
      entity: 'orders',
      entityId: id,
      action: 'update',
      before: before.toObject(),
      after: updated,
      by: user.id
    });
  }

  @Post(':id/reschedule')
  @Permissions('orders.write')
  async reschedule(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: RescheduleOrderDto
  ) {
    const before = await this.ordersService.findById(tenantId, id);
    const updated = await this.ordersService.reschedule(tenantId, id, dto, user.id);
    return withAudit(updated, {
      tenantId,
      entity: 'orders',
      entityId: id,
      action: 'update',
      before: before.toObject(),
      after: updated,
      by: user.id
    });
  }

  @Post(':id/start')
  @Permissions('orders.write')
  async start(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string
  ) {
    const before = await this.ordersService.findById(tenantId, id);
    const started = await this.ordersService.startOrder(tenantId, id, user.id);
    return withAudit(started, {
      tenantId,
      entity: 'orders',
      entityId: id,
      action: 'update',
      before: before.toObject(),
      after: started,
      by: user.id
    });
  }

  @Post(':id/finish')
  @Permissions('orders.write')
  async finish(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: FinishOrderDto
  ) {
    const before = await this.ordersService.findById(tenantId, id);
    const finished = await this.ordersService.finishOrder(tenantId, id, dto, user.id);
    return withAudit(finished, {
      tenantId,
      entity: 'orders',
      entityId: id,
      action: 'update',
      before: before.toObject(),
      after: finished,
      by: user.id
    });
  }

  @Post(':id/materials/reserve')
  @Permissions('orders.write')
  async reserveMaterials(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: OrderMaterialsDto
  ) {
    const order = await this.ordersService.reserveMaterials(tenantId, id, dto, user.id);
    return withAudit(order, {
      tenantId,
      entity: 'orders',
      entityId: id,
      action: 'update',
      after: order,
      by: user.id
    });
  }

  @Post(':id/materials/deduct')
  @Permissions('orders.write')
  async deductMaterials(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: OrderMaterialsDto
  ) {
    const order = await this.ordersService.deductMaterials(tenantId, id, dto, user.id);
    return withAudit(order, {
      tenantId,
      entity: 'orders',
      entityId: id,
      action: 'update',
      after: order,
      by: user.id
    });
  }

  @Post(':id/purchases')
  @Permissions('orders.write')
  async createPurchase(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: CreateOrderPurchaseDto
  ) {
    const purchase = await this.ordersService.createPurchaseFromOrder(tenantId, id, dto, user.id);
    return withAudit(purchase, {
      tenantId,
      entity: 'purchases',
      entityId: purchase._id,
      action: 'create',
      after: purchase,
      by: user.id
    });
  }

  @Post(':id/upload/photo')
  @Permissions('orders.write')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadPhoto(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File
  ) {
    return this.ordersService.addPhoto(tenantId, id, file, user.id);
  }

  @Post(':id/signature')
  @Permissions('orders.write')
  async signature(
    @TenantId() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body('base64') base64: string
  ) {
    const result = await this.ordersService.addSignature(tenantId, id, base64, user.id);
    return withAudit(result, {
      tenantId,
      entity: 'orders',
      entityId: id,
      action: 'update',
      after: result,
      by: user.id
    });
  }

  @Get(':id/pdf')
  @Permissions('orders.read')
  async pdf(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Query('type') type: 'report' | 'budget' | 'warranty' = 'report'
  ) {
    return this.ordersService.generatePdf(tenantId, id, type);
  }
}
