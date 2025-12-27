import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SignupDto } from './dto/signup.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Tenant, TenantDocument } from '../../core/tenancy/tenant.schema';
import { Model } from 'mongoose';
import { UsersService } from '../users/users.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { StripeService } from '../subscriptions/stripe.service';
import { createHash, randomInt } from 'crypto';
import { AuditService } from '../../core/audit/audit.service';
import { ActivationCode, ActivationCodeDocument } from './activation-code.schema';
import { EmailService } from '../../core/notifications/email.service';
import { VerifySignupDto } from './dto/verify-signup.dto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SignupService {
  private readonly logger = new Logger(SignupService.name);

  constructor(
    @InjectModel(Tenant.name) private readonly tenantModel: Model<TenantDocument>,
    @InjectModel(ActivationCode.name) private readonly activationModel: Model<ActivationCodeDocument>,
    private readonly usersService: UsersService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly stripeService: StripeService,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService
  ) {}

  private generateActivationCode() {
    return randomInt(100000, 1000000).toString();
  }

  private hashCode(code: string) {
    return createHash('sha256').update(code).digest('hex');
  }

  private normalizePhone(raw: string) {
    const digits = raw.replace(/\D/g, '');
    if (!digits) {
      throw new BadRequestException({ code: 'INVALID_PHONE', message: 'Telefone inválido' });
    }
    let e164 = digits.startsWith('55') ? `+${digits}` : digits.length === 10 || digits.length === 11 ? `+55${digits}` : `+${digits}`;
    if (!/^\+?[1-9]\d{7,14}$/.test(e164)) {
      throw new BadRequestException({
        code: 'INVALID_PHONE',
        message: 'Telefone deve ser válido (DDI+DDD+número)'
      });
    }
    return e164;
  }

  async register(dto: SignupDto) {
    const normalizedEmail = dto.ownerEmail.toLowerCase();
    const normalizedPhone = this.normalizePhone(dto.ownerPhone);
    if (await this.usersService.findByEmailAnyTenant(normalizedEmail)) {
      throw new ConflictException({ code: 'EMAIL_IN_USE', message: 'Este e-mail ja esta em uso.' });
    }
    if (await this.tenantModel.findOne({ document: dto.document })) {
      throw new ConflictException({ code: 'DOCUMENT_IN_USE', message: 'Documento ja cadastrado.' });
    }

    const tenant = await this.tenantModel.create({
      name: dto.companyName,
      document: dto.document,
      contactEmail: normalizedEmail,
      contactPhone: normalizedPhone,
      status: 'pending'
    });

    let stripeCustomerId: string | undefined;
    if (this.stripeService.isEnabled()) {
      try {
        const customer = await this.stripeService.createCustomer({
          email: normalizedEmail,
          name: dto.companyName,
          phone: normalizedPhone,
          metadata: { tenantId: tenant._id.toString() }
        });
        stripeCustomerId = customer.id;
        tenant.stripeCustomerId = customer.id;
        await tenant.save();
      } catch (error) {
        this.logger.error('Failed to create Stripe customer', error instanceof Error ? error.stack : undefined);
      }
    }

    const owner = await this.usersService.create(
      tenant._id.toString(),
      {
        name: dto.ownerName,
        email: normalizedEmail,
        password: dto.password,
        role: 'owner',
        phone: normalizedPhone,
        document: dto.document,
        active: false,
        mustChangePassword: false
      } as any,
      'signup'
    );
    const ownerId = (owner as any)._id?.toString?.() ?? (owner as any).id;

    await this.subscriptionsService.ensureSubscription(tenant._id.toString(), dto.billingDay);

    const code = this.generateActivationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await this.activationModel.findOneAndUpdate(
      { tenantId: tenant._id.toString() },
      {
        tenantId: tenant._id.toString(),
        userId: ownerId,
        phone: normalizedPhone,
        codeHash: this.hashCode(code),
        expiresAt,
        attempts: 0
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    let delivered = false;
    if (this.emailService.isEnabled()) {
      try {
        await this.emailService.sendActivationCode(normalizedEmail, code);
        delivered = true;
      } catch (err: any) {
        this.logger.error('Failed to send email activation', err?.stack || String(err));
      }
    }
    if (!delivered) {
      if ((this.configService.get<string>('app.env') || 'development') === 'production') {
        throw new BadRequestException({
          code: 'DELIVERY_UNAVAILABLE',
          message: 'Nenhum provedor de envio configurado (Email).'
        });
      } else {
        this.logger.warn('Nenhum provedor configurado; retornando activationCode para uso não-produtivo');
      }
    }

    await this.auditService.log({
      tenantId: tenant._id.toString(),
      entity: 'signups',
      entityId: tenant._id.toString(),
      action: 'create',
      after: {
        companyName: dto.companyName,
        ownerEmail: normalizedEmail,
        document: dto.document
      },
      by: owner._id.toString()
    });

    return {
      tenantId: tenant._id.toString(),
      tenantName: tenant.name,
      stripeCustomerId,
      owner,
      activationExpiresAt: expiresAt,
      activationCode:
        (this.configService.get<string>('app.env') || 'development') !== 'production' ? code : undefined
    };
  }

  async verify(dto: VerifySignupDto) {
    const record = await this.activationModel.findOne({ tenantId: dto.tenantId });
    if (!record) {
      throw new BadRequestException({ code: 'ACTIVATION_NOT_FOUND', message: 'Solicitacao de ativacao nao encontrada.' });
    }
    if (record.attempts >= 5) {
      throw new BadRequestException({ code: 'ACTIVATION_LOCKED', message: 'Muitas tentativas invalidas. Aguarde e tente novamente.' });
    }
    if (record.expiresAt < new Date()) {
      throw new BadRequestException({ code: 'CODE_EXPIRED', message: 'Codigo expirado. Solicite um novo.' });
    }
    const hash = this.hashCode(dto.code);
    if (hash !== record.codeHash) {
      record.attempts += 1;
      await record.save();
      throw new BadRequestException({ code: 'INVALID_CODE', message: 'Codigo incorreto. Tente novamente.' });
    }

    const tenant = await this.tenantModel.findById(dto.tenantId);
    if (!tenant) {
      throw new NotFoundException({ code: 'TENANT_NOT_FOUND', message: 'Conta nao encontrada.' });
    }
    tenant.status = 'active';
    tenant.active = true;
    await tenant.save();

    const user = await this.usersService.findById(dto.tenantId, record.userId);
    if (!user) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'Dono da conta nao encontrado.' });
    }
    user.active = true;
    user.updatedBy = record.userId;
    await user.save();

    await this.activationModel.deleteOne({ _id: record._id });

    await this.auditService.log({
      tenantId: dto.tenantId,
      entity: 'signups',
      entityId: dto.tenantId,
      action: 'update',
      after: {
        companyName: tenant.name,
        ownerEmail: user.email,
        status: 'active'
      },
      by: record.userId
    });

    return {
      tenantId: dto.tenantId,
      ownerId: record.userId
    };
  }
}
