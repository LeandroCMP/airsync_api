import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class TimelineEntry {
  @Prop({ required: true })
  tenantId: string;

  @Prop({ required: true })
  clientId: string;

  @Prop({ required: true, enum: ['call', 'whatsapp', 'email', 'note', 'nps'] })
  type: 'call' | 'whatsapp' | 'email' | 'note' | 'nps';

  @Prop({ required: true })
  at: Date;

  @Prop()
  by?: string;

  @Prop({ required: true })
  text: string;
}

export type TimelineEntryDocument = TimelineEntry & Document;
export const TimelineEntrySchema = SchemaFactory.createForClass(TimelineEntry);
TimelineEntrySchema.index({ tenantId: 1, clientId: 1, at: 1 });
