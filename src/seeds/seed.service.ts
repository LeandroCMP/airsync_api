import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Tenant, TenantDocument } from '../core/tenancy/tenant.schema';
import { User, UserDocument } from '../modules/users/user.schema';
import { Client, ClientDocument } from '../modules/clients/client.schema';
import { Order, OrderDocument } from '../modules/orders/order.schema';
import { InventoryItem, InventoryItemDocument } from '../modules/inventory/inventory-item.schema';
import * as bcrypt from 'bcrypt';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectModel(Tenant.name) private readonly tenantModel: Model<TenantDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Client.name) private readonly clientModel: Model<ClientDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(InventoryItem.name) private readonly inventoryModel: Model<InventoryItemDocument>
  ) {}

  async onModuleInit() {
    const tenants = await this.tenantModel.countDocuments();
    if (tenants > 0) {
      return;
    }
    const tenant = await this.tenantModel.create({ name: 'Demo' });
    const passwordHash = await bcrypt.hash('admin123', 10);
    const admin = await this.userModel.create({
      tenantId: tenant._id.toString(),
      name: 'Admin Demo',
      email: 'admin@demo.local',
      passwordHash,
      role: 'admin',
      permissions: ['*'],
      active: true
    });
    const client = await this.clientModel.create({
      tenantId: tenant._id.toString(),
      name: 'Leandro Campos',
      phones: ['+55 11 99999-0000'],
      emails: ['leandro@example.com'],
      tags: ['vip']
    });
    const inventoryItem = await this.inventoryModel.create({
      tenantId: tenant._id.toString(),
      name: 'Filtro de Ar',
      sku: 'FLT-7500',
      unit: 'un',
      minQty: 2,
      onHand: 10,
      reserved: 0,
      entries: []
    });
    await this.orderModel.create({
      tenantId: tenant._id.toString(),
      clientId: client._id.toString(),
      locationId: '',
      status: 'scheduled',
      technicianIds: [admin._id.toString()],
      materials: [{ itemId: inventoryItem._id.toString(), qty: 2, reserved: false }],
      checklist: [],
      timesheet: {},
      photoUrls: [],
      billing: { items: [], subtotal: 0, discount: 0, total: 0, status: 'pending' },
      audit: { createdBy: admin._id.toString(), updatedBy: admin._id.toString() }
    });
    this.logger.log('Seed data created');
  }
}
