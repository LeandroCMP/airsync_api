import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TimelineEntry, TimelineEntryDocument } from './timeline-entry.schema';
import { CreateTimelineDto } from './dto/create-timeline.dto';
import { SubmitNpsDto } from './dto/submit-nps.dto';
import { Client, ClientDocument } from '../clients/client.schema';

@Injectable()
export class CrmService {
  constructor(
    @InjectModel(TimelineEntry.name) private readonly timelineModel: Model<TimelineEntryDocument>,
    @InjectModel(Client.name) private readonly clientModel: Model<ClientDocument>
  ) {}

  async addEntry(tenantId: string, dto: CreateTimelineDto, userId: string) {
    const entry = await this.timelineModel.create({
      tenantId,
      clientId: dto.clientId,
      type: dto.type,
      at: dto.at ? new Date(dto.at) : new Date(),
      by: dto.by || userId,
      text: dto.text
    });
    return entry.toObject();
  }

  async submitNps(tenantId: string, dto: SubmitNpsDto) {
    const entry = await this.timelineModel.create({
      tenantId,
      clientId: dto.clientId,
      type: 'nps',
      at: new Date(),
      text: `NPS ${dto.score}: ${dto.comment || ''}`
    });
    await this.clientModel.updateOne(
      { tenantId, _id: dto.clientId },
      {
        $set: {
          nps: {
            score: dto.score,
            comment: dto.comment,
            at: new Date()
          }
        }
      }
    );
    return entry.toObject();
  }

  async listTimeline(tenantId: string, clientId: string) {
    return this.timelineModel.find({ tenantId, clientId }).sort({ at: -1 }).lean();
  }
}
