import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
@Schema()
export class TenantCreditFee {
  @Prop({ required: true })
  installments: number;

  @Prop({ required: true })
  feePercent: number;
}

const TenantCreditFeeSchema = SchemaFactory.createForClass(TenantCreditFee);

@Schema({ timestamps: true })
export class Tenant {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop({ type: [String], default: [] })
  domains: string[];

  @Prop({ default: true })
  active: boolean;

  @Prop()
  pixKey?: string;

  @Prop({ type: [TenantCreditFeeSchema], default: [] })
  creditFees: TenantCreditFee[];

  @Prop({ default: 0 })
  debitFeePercent?: number;

  @Prop({ default: 0 })
  chequeFeePercent?: number;

  @Prop({ enum: ['active', 'past_due', 'suspended'], default: 'active' })
  billingStatus?: 'active' | 'past_due' | 'suspended';

  @Prop()
  suspendedAt?: Date;

  @Prop()
  suspensionReason?: string;
}

export type TenantDocument = Tenant & Document;
export const TenantSchema = SchemaFactory.createForClass(Tenant);
