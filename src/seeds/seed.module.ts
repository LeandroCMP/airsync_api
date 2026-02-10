import { Module } from '@nestjs/common';
import { SeedService } from './seed.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Tenant, TenantSchema } from '../core/tenancy/tenant.schema';
import { User, UserSchema } from '../modules/users/user.schema';
import { Client, ClientSchema } from '../modules/clients/client.schema';
import { Order, OrderSchema } from '../modules/orders/order.schema';
import { InventoryItem, InventoryItemSchema } from '../modules/inventory/inventory-item.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Tenant.name, schema: TenantSchema },
      { name: User.name, schema: UserSchema },
      { name: Client.name, schema: ClientSchema },
      { name: Order.name, schema: OrderSchema },
      { name: InventoryItem.name, schema: InventoryItemSchema }
    ])
  ],
  providers: [SeedService]
})
export class SeedModule {}
