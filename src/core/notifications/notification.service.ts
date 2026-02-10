import { Injectable, Logger } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';

export interface NotificationPayload {
  type: string;
  tenantId: string;
  message: string;
  [key: string]: any;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly whatsappService: WhatsappService) {}

  async notify(payload: NotificationPayload) {
    this.logger.log(`[Notification] ${payload.type} | tenant=${payload.tenantId} | message=${payload.message}`);
    try {
      const waSent = await this.whatsappService.trySendTemplate(payload);
      if (waSent) {
        this.logger.log(
          `[Notification][WA] enviado | tenant=${payload.tenantId} | phoneId=${waSent.phoneId} | to=${waSent.to}`
        );
      }
    } catch (err) {
      this.logger.warn(
        `[Notification][WA] falha | tenant=${payload.tenantId} | ${err instanceof Error ? err.message : err}`
      );
    }
  }
}
