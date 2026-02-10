import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Location {
  @Prop({ required: true })
  tenantId: string;

  @Prop({ required: true })
  clientId: string;

  @Prop({ required: true })
  label: string;

  @Prop({ type: Object, required: true })
  address: {
    street?: string;
    number?: string;
    city?: string;
    state?: string;
    zip?: string;
  };

  @Prop({ type: Object })
  geo?: {
    lat: number;
    lng: number;
  };

  @Prop()
  notes?: string;

  @Prop()
  updatedBy?: string;

  @Prop({ default: null })
  deletedAt?: Date | null;
}

export type LocationDocument = Location & Document;
export const LocationSchema = SchemaFactory.createForClass(Location);
LocationSchema.index({ tenantId: 1, clientId: 1 });
