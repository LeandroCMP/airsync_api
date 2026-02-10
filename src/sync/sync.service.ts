import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Client, ClientDocument } from '../modules/clients/client.schema';
import { Location, LocationDocument } from '../modules/locations/location.schema';
import { Equipment, EquipmentDocument } from '../modules/equipment/equipment.schema';
import { Order, OrderDocument } from '../modules/orders/order.schema';
import { InventoryItem, InventoryItemDocument } from '../modules/inventory/inventory-item.schema';
import { Supplier, SupplierDocument } from '../modules/suppliers/supplier.schema';
import { Purchase, PurchaseDocument } from '../modules/purchases/purchase.schema';
import { FinanceTransaction, FinanceTransactionDocument } from '../modules/finance/finance-transaction.schema';
import { Contract, ContractDocument } from '../modules/contracts/contract.schema';
import { FleetVehicle, FleetVehicleDocument } from '../modules/fleet/fleet-vehicle.schema';
import { TimelineEntry, TimelineEntryDocument } from '../modules/crm/timeline-entry.schema';

@Injectable()
export class SyncService {
  private scopes: Record<string, Model<any>>;

  constructor(
    @InjectModel(Client.name) private readonly clients: Model<ClientDocument>,
    @InjectModel(Location.name) private readonly locations: Model<LocationDocument>,
    @InjectModel(Equipment.name) private readonly equipments: Model<EquipmentDocument>,
    @InjectModel(Order.name) private readonly orders: Model<OrderDocument>,
    @InjectModel(InventoryItem.name) private readonly inventory: Model<InventoryItemDocument>,
    @InjectModel(Supplier.name) private readonly suppliers: Model<SupplierDocument>,
    @InjectModel(Purchase.name) private readonly purchases: Model<PurchaseDocument>,
    @InjectModel(FinanceTransaction.name) private readonly finances: Model<FinanceTransactionDocument>,
    @InjectModel(Contract.name) private readonly contracts: Model<ContractDocument>,
    @InjectModel(FleetVehicle.name) private readonly fleet: Model<FleetVehicleDocument>,
    @InjectModel(TimelineEntry.name) private readonly timeline: Model<TimelineEntryDocument>
  ) {
    this.scopes = {
      clients: this.clients,
      locations: this.locations,
      equipment: this.equipments,
      orders: this.orders,
      inventory: this.inventory,
      suppliers: this.suppliers,
      purchases: this.purchases,
      finance: this.finances,
      contracts: this.contracts,
      fleet: this.fleet,
      timeline: this.timeline
    };
  }

  async getChanges(
    tenantId: string,
    scope: string[],
    since: Date,
    includeDeleted: boolean
  ) {
    const result: Record<string, any[]> = {};
    for (const key of scope) {
      const model = this.scopes[key];
      if (!model) continue;
      const query: any = { tenantId, updatedAt: { $gt: since } };
      const docs = await model.find(query).lean();
      const data = [...docs];
      if (includeDeleted && model.schema.path('deletedAt')) {
        const deleted = await model.find({ tenantId, deletedAt: { $gt: since } }).lean();
        data.push(...deleted.map((doc) => ({ _id: doc._id, deletedAt: doc.deletedAt }))); // tombstones
      }
      result[key] = data;
    }
    return result;
  }
}
