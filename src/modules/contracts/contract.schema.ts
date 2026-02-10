import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Contract {
  @Prop({ required: true })
  tenantId: string;

  @Prop({ required: true })
  clientId: string;

  @Prop({ type: [String], default: [] })
  equipmentIds: string[];

  @Prop({ type: Object, required: true })
  plan: {
    name: string;
    intervalMonths: number;
    slaHours: number;
  };

  @Prop({ type: [Date], default: [] })
  nextVisits: Date[];

  @Prop({ required: true })
  priceMonthly: number;

  @Prop({ required: true, enum: ['active', 'paused', 'ended'], default: 'active' })
  status: 'active' | 'paused' | 'ended';

  @Prop()
  notes?: string;
}

export type ContractDocument = Contract & Document;
export const ContractSchema = SchemaFactory.createForClass(Contract);
ContractSchema.index({ tenantId: 1, clientId: 1 });
