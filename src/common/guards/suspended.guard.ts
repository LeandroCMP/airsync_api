import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { TenantService } from '../../core/tenancy/tenant.service';

@Injectable()
export class SuspendedGuard implements CanActivate {
  constructor(private readonly tenantService: TenantService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user || !user.tenantId) {
      return true;
    }
    const tenant = await this.tenantService.findById(user.tenantId);
    if (!tenant) {
      throw new ForbiddenException({ code: 'TENANT_NOT_FOUND', message: 'Conta nao encontrada.' });
    }
    const suspended = tenant.billingStatus === 'suspended';
    if (!suspended) {
      return true;
    }

    const isOwner = user.role === 'owner' || user.role === 'admin';
    if (!isOwner) {
      throw new ForbiddenException({
        code: 'ACCOUNT_SUSPENDED',
        message: 'Acesso bloqueado. Contate o responsavel da conta para regularizar o pagamento.'
      });
    }

    const path: string = req.originalUrl || req.url || '';
    const allowedPrefixes = ['/v1/subscriptions', '/v1/auth/me', '/v1/auth/logout'];
    const allowed = allowedPrefixes.some((p) => path.startsWith(p));
    if (!allowed) {
      throw new ForbiddenException({
        code: 'ACCOUNT_SUSPENDED',
        message: 'Conta suspensa. Regularize o pagamento.'
      });
    }
    return true;
  }
}
