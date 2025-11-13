import { Injectable, Logger } from '@nestjs/common';

export interface NotificationPayload {
  type: 'purchase_submitted' | 'purchase_approved' | 'purchase_ordered';
  tenantId: string;
  purchaseId: string;
  by?: string;
  message: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  async notify(payload: NotificationPayload) {
    // Placeholder: integrate with email/SMS/push providers as needed.
    this.logger.log(
      `[Notification] ${payload.type} | tenant=${payload.tenantId} | purchase=${payload.purchaseId} | message=${payload.message}`
    );
  }
}

