import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class FleetCheck {
  @Prop({ required: true })
  at: Date;

  @Prop({ required: true })
  km: number;

  @Prop({ required: true })
  fuelLevel: number;

  @Prop({ type: [String], default: [] })
  photos: string[];

  @Prop()
  notes?: string;
}

const FleetCheckSchema = SchemaFactory.createForClass(FleetCheck);

@Schema()
export class FuelLog {
  @Prop({ required: true })
  at: Date;

  @Prop({ required: true })
  km: number;

  @Prop({ required: true })
  liters: number;

  @Prop({ required: true, enum: ['gasoline', 'ethanol', 'diesel', 'gnv', 'electric'] })
  fuelType: string;

  @Prop({ required: true })
  cost: number;
}

const FuelLogSchema = SchemaFactory.createForClass(FuelLog);

@Schema()
export class MaintenanceEntry {
  @Prop({ required: true })
  type: string;

  @Prop({ required: true })
  at: Date;

  @Prop({ required: true })
  atKm: number;

  @Prop({ required: true })
  cost: number;

  @Prop()
  notes?: string;
}

const MaintenanceEntrySchema = SchemaFactory.createForClass(MaintenanceEntry);

@Schema({ timestamps: true })
export class FleetVehicle {
  @Prop({ required: true })
  tenantId: string;

  @Prop({ required: true })
  plate: string;

  @Prop()
  model?: string;

  @Prop()
  year?: number;

  @Prop()
  teamId?: string;

  @Prop({ default: 0 })
  odometer: number;

  @Prop({ type: [FleetCheckSchema], default: [] })
  checks: FleetCheck[];

  @Prop({ type: [FuelLogSchema], default: [] })
  fuelLogs: FuelLog[];

  @Prop({ type: [MaintenanceEntrySchema], default: [] })
  maintenances: MaintenanceEntry[];

  @Prop()
  updatedBy?: string;

  @Prop({ default: null })
  deletedAt?: Date | null;
}

export type FleetVehicleDocument = FleetVehicle & Document;
export const FleetVehicleSchema = SchemaFactory.createForClass(FleetVehicle);
FleetVehicleSchema.index(
  { tenantId: 1, plate: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } }
);
FleetVehicleSchema.index({ tenantId: 1, deletedAt: 1 });
