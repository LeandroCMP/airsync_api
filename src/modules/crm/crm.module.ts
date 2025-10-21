import { Module } from '@nestjs/common';
import { CrmService } from './crm.service';
import { CrmController } from './crm.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { TimelineEntry, TimelineEntrySchema } from './timeline-entry.schema';
import { Client, ClientSchema } from '../clients/client.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TimelineEntry.name, schema: TimelineEntrySchema },
      { name: Client.name, schema: ClientSchema }
    ])
  ],
  controllers: [CrmController],
  providers: [CrmService],
  exports: [CrmService]
})
export class CrmModule {}
