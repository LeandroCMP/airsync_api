import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly client: Resend | null;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('email.resendApiKey');
    this.from = this.configService.get<string>('email.from') || 'no-reply@example.com';
    this.client = apiKey ? new Resend(apiKey) : null;
    if (!apiKey) {
      this.logger.warn('Email disabled: missing RESEND_API_KEY');
    }
  }

  isEnabled() {
    return !!this.client;
  }

  async sendMail(to: string, subject: string, text: string, html?: string) {
    if (!this.client) {
      this.logger.warn(`Email skipped (disabled) | to=${to} subject=${subject}`);
      return;
    }
    const res = await this.client.emails.send({
      from: this.from,
      to,
      subject,
      text,
      html
    });
    if (res.error) {
      this.logger.error(`Email send failed | to=${to} subject=${subject} | ${res.error.message}`);
      throw new Error(res.error.message);
    }
    this.logger.log(`Email sent | to=${to} subject=${subject}`);
  }

  async sendActivationCode(email: string, code: string) {
    const subject = 'Seu código de ativação';
    const text = `Seu código de ativação é ${code}. Ele expira em 10 minutos.`;
    const html = `<p>Seu código de ativação é <strong>${code}</strong>.</p><p>Ele expira em 10 minutos.</p>`;
    return this.sendMail(email, subject, text, html);
  }
}
