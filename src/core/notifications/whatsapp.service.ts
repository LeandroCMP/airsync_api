import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomBytes } from 'crypto';
import { Tenant, TenantDocument } from '../tenancy/tenant.schema';
import { NotificationPayload } from './notification.service';

type GraphTokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
};

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(Tenant.name) private readonly tenantModel: Model<TenantDocument>
  ) {}

  private getGraphVersion() {
    return this.configService.get<string>('whatsapp.graphVersion') || 'v19.0';
  }

  private getGraphBase() {
    return `https://graph.facebook.com/${this.getGraphVersion()}`;
  }

  private getAppConfig() {
    const appId = this.configService.get<string>('whatsapp.appId');
    const appSecret = this.configService.get<string>('whatsapp.appSecret');
    const redirectUri = this.configService.get<string>('whatsapp.redirectUri');
    if (!appId || !appSecret || !redirectUri) {
      throw new BadRequestException({
        code: 'WHATSAPP_CONFIG_MISSING',
        message: 'Configurações do WhatsApp incompletas. Defina WHATSAPP_APP_ID/SECRET/REDIRECT_URI.'
      });
    }
    return { appId, appSecret, redirectUri };
  }

  buildOnboardingUrl(tenantId: string) {
    const { appId, redirectUri } = this.getAppConfig();
    const statePayload = { tenantId, nonce: randomBytes(8).toString('hex') };
    const state = Buffer.from(JSON.stringify(statePayload)).toString('base64url');
    const scope = 'whatsapp_business_management,whatsapp_business_messaging,business_management';
    const url = `https://www.facebook.com/${this.getGraphVersion()}/dialog/oauth?client_id=${appId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${encodeURIComponent(state)}` +
      `&scope=${encodeURIComponent(scope)}`;
    return { url, state };
  }

  private decodeState(raw?: string): { tenantId?: string; nonce?: string } {
    if (!raw) return {};
    try {
      const decoded = Buffer.from(raw, 'base64url').toString('utf8');
      return JSON.parse(decoded);
    } catch (err) {
      this.logger.warn(`Falha ao decodificar state: ${String(err)}`);
      return {};
    }
  }

  private async exchangeCode(code: string): Promise<GraphTokenResponse> {
    const { appId, appSecret, redirectUri } = this.getAppConfig();
    const url =
      `${this.getGraphBase()}/oauth/access_token?client_id=${appId}` +
      `&client_secret=${appSecret}&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&code=${encodeURIComponent(code)}`;
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`Falha ao trocar code por token | status=${res.status} body=${text}`);
      throw new BadRequestException({
        code: 'WHATSAPP_OAUTH_FAILED',
        message: 'Nao foi possivel concluir a conexao com o WhatsApp. Tente novamente.'
      });
    }
    return (await res.json()) as GraphTokenResponse;
  }

  private async resolveWaba(accessToken: string): Promise<string | undefined> {
    const res = await fetch(`${this.getGraphBase()}/me/whatsapp_business_accounts?access_token=${accessToken}`);
    if (!res.ok) {
      this.logger.warn(`Nao foi possivel listar WABA | status=${res.status}`);
      return undefined;
    }
    const data: any = await res.json();
    const id = data?.data?.[0]?.id;
    return id;
  }

  private async resolvePhone(accessToken: string, wabaId?: string): Promise<{ phoneId?: string; wabaId?: string }> {
    const resolvedWabaId = wabaId || (await this.resolveWaba(accessToken));
    if (!resolvedWabaId) return {};
    const res = await fetch(
      `${this.getGraphBase()}/${resolvedWabaId}/phone_numbers?access_token=${accessToken}`
    );
    if (!res.ok) {
      this.logger.warn(`Nao foi possivel obter phone_number_id | status=${res.status}`);
      return { wabaId: resolvedWabaId };
    }
    const data: any = await res.json();
    const phoneId = data?.data?.[0]?.id;
    return { phoneId, wabaId: resolvedWabaId };
  }

  async handleCallback(code: string, state?: string) {
    if (!code) {
      throw new BadRequestException({ code: 'WHATSAPP_CODE_MISSING', message: 'Code nao informado pelo WhatsApp.' });
    }
    const parsedState = this.decodeState(state);
    const tenantId = parsedState.tenantId;
    if (!tenantId) {
      throw new BadRequestException({ code: 'WHATSAPP_STATE_INVALID', message: 'Tenant nao encontrado no state.' });
    }
    const tokenData = await this.exchangeCode(code);
    const { phoneId, wabaId } = await this.resolvePhone(tokenData.access_token);
    const expiresAt = tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : undefined;

    await this.tenantModel.updateOne(
      { _id: tenantId },
      {
        whatsappEnabled: true,
        whatsappToken: tokenData.access_token,
        whatsappPhoneId: phoneId,
        whatsappWabaId: wabaId,
        whatsappExpiresAt: expiresAt,
        whatsappConnectedAt: new Date()
      }
    );

    return {
      connected: true,
      tenantId,
      phoneId,
      wabaId,
      expiresAt
    };
  }

  async getStatus(tenantId: string) {
    const tenant = await this.tenantModel
      .findById(tenantId)
      .select([
        'whatsappEnabled',
        'whatsappPhoneId',
        'whatsappWabaId',
        'whatsappExpiresAt',
        'whatsappConnectedAt'
      ])
      .lean();
    if (!tenant) {
      throw new BadRequestException({ code: 'TENANT_NOT_FOUND', message: 'Tenant nao encontrado.' });
    }
    return {
      enabled: tenant.whatsappEnabled || false,
      phoneId: tenant.whatsappPhoneId,
      wabaId: tenant.whatsappWabaId,
      expiresAt: tenant.whatsappExpiresAt,
      connectedAt: tenant.whatsappConnectedAt
    };
  }

  private async sendTemplateMessage(params: {
    tenant: TenantDocument;
    to: string;
    template: { name: string; language?: string; variables?: string[] };
  }) {
    const token = params.tenant.whatsappToken;
    const phoneId = params.tenant.whatsappPhoneId;
    if (!token || !phoneId) {
      throw new BadRequestException({
        code: 'WHATSAPP_NOT_CONNECTED',
        message: 'Tenant nao possui WhatsApp conectado.'
      });
    }
    const language = params.template.language || 'pt_BR';
    const components =
      params.template.variables && params.template.variables.length
        ? [
            {
              type: 'body',
              parameters: params.template.variables.map((v) => ({ type: 'text', text: v }))
            }
          ]
        : undefined;
    const payload: any = {
      messaging_product: 'whatsapp',
      to: params.to,
      type: 'template',
      template: {
        name: params.template.name,
        language: { code: language }
      }
    };
    if (components) {
      payload.template.components = components;
    }
    const res = await fetch(`${this.getGraphBase()}/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const text = await res.text();
      this.logger.warn(
        `Falha ao enviar template WA | tenant=${params.tenant._id} status=${res.status} body=${text}`
      );
      throw new BadRequestException({
        code: 'WHATSAPP_SEND_FAILED',
        message: 'Falha ao enviar mensagem WhatsApp.'
      });
    }
    return { phoneId, to: params.to };
  }

  async trySendTemplate(payload: NotificationPayload) {
    const tenant = await this.tenantModel.findById(payload.tenantId);
    if (!tenant || !tenant.whatsappEnabled || !tenant.whatsappToken || !tenant.whatsappPhoneId) {
      return null;
    }
    const to = payload.to || payload.phone;
    if (!to) {
      return null;
    }
    // Mapeamento simples de templates por tipo; em produção, ideal permitir configuração.
    const templateMap: Record<string, { name: string; vars?: string[] }> = {
      subscription_past_due: { name: 'subscription_past_due', vars: [payload.message] },
      subscription_suspended: { name: 'subscription_suspended', vars: [payload.message] },
      subscription_reminder_before: { name: 'maintenance_reminder', vars: [payload.message] },
      subscription_reminder_due: { name: 'maintenance_reminder', vars: [payload.message] },
      maintenance_reminder: { name: 'maintenance_reminder', vars: [payload.message] },
      order_scheduled: { name: 'order_scheduled', vars: [payload.message] },
      order_finished: { name: 'order_finished', vars: [payload.message] }
    };
    const tpl = templateMap[payload.type];
    if (!tpl) return null;
    return this.sendTemplateMessage({
      tenant,
      to,
      template: {
        name: tpl.name,
        variables: tpl.vars
      }
    });
  }
}
