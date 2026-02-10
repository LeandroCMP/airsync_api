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

  @Prop({ unique: true, sparse: true })
  document?: string;

  @Prop({ unique: true, sparse: true })
  contactEmail?: string;

  @Prop()
  contactPhone?: string;

  @Prop({ type: [String], default: [] })
  domains: string[];

  @Prop({ default: true })
  active: boolean;

  @Prop({ enum: ['pending', 'active', 'suspended'], default: 'pending' })
  status?: 'pending' | 'active' | 'suspended';

  @Prop()
  pixKey?: string;

  @Prop()
  stripeCustomerId?: string;

  @Prop({ default: false })
  whatsappEnabled?: boolean;

  @Prop()
  whatsappToken?: string;

  @Prop()
  whatsappPhoneId?: string;

  @Prop()
  whatsappWabaId?: string;

  @Prop()
  whatsappExpiresAt?: Date;

  @Prop()
  whatsappConnectedAt?: Date;

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
TenantSchema.index({ document: 1 }, { unique: true, sparse: true });
TenantSchema.index({ contactEmail: 1 }, { unique: true, sparse: true });
