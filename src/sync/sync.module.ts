import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Client, ClientSchema } from '../modules/clients/client.schema';
import { Location, LocationSchema } from '../modules/locations/location.schema';
import { Equipment, EquipmentSchema } from '../modules/equipment/equipment.schema';
import { Order, OrderSchema } from '../modules/orders/order.schema';
import { InventoryItem, InventoryItemSchema } from '../modules/inventory/inventory-item.schema';
import { Supplier, SupplierSchema } from '../modules/suppliers/supplier.schema';
import { Purchase, PurchaseSchema } from '../modules/purchases/purchase.schema';
import { FinanceTransaction, FinanceTransactionSchema } from '../modules/finance/finance-transaction.schema';
import { Contract, ContractSchema } from '../modules/contracts/contract.schema';
import { FleetVehicle, FleetVehicleSchema } from '../modules/fleet/fleet-vehicle.schema';
import { TimelineEntry, TimelineEntrySchema } from '../modules/crm/timeline-entry.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Client.name, schema: ClientSchema },
      { name: Location.name, schema: LocationSchema },
      { name: Equipment.name, schema: EquipmentSchema },
      { name: Order.name, schema: OrderSchema },
      { name: InventoryItem.name, schema: InventoryItemSchema },
      { name: Supplier.name, schema: SupplierSchema },
      { name: Purchase.name, schema: PurchaseSchema },
      { name: FinanceTransaction.name, schema: FinanceTransactionSchema },
      { name: Contract.name, schema: ContractSchema },
      { name: FleetVehicle.name, schema: FleetVehicleSchema },
      { name: TimelineEntry.name, schema: TimelineEntrySchema }
    ])
  ],
  controllers: [SyncController],
  providers: [SyncService]
})
export class SyncModule {}
