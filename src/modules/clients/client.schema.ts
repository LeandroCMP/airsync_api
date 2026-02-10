import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Client {
  @Prop({ required: true, index: true })
  tenantId: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  docNumber?: string;

  @Prop({ type: [String], default: [] })
  phones: string[];

  @Prop({ type: [String], default: [] })
  emails: string[];

  @Prop()
  notes?: string;

  @Prop()
  updatedBy?: string;

  @Prop({ default: null })
  deletedAt?: Date | null;
}

export type ClientDocument = Client & Document;
export const ClientSchema = SchemaFactory.createForClass(Client);
ClientSchema.index({ tenantId: 1, name: 1 });
ClientSchema.index({ tenantId: 1, docNumber: 1 });
