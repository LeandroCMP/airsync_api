import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (isPublic) {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    let tenantId = request.headers['x-tenant-id'] as string;
    if (!tenantId && request.user && request.user.tenantId) {
      tenantId = request.user.tenantId;
    }
    if (!tenantId) {
      throw new ForbiddenException({ code: 'TENANT_REQUIRED', message: 'Tenant not resolved' });
    }
    request.tenantId = tenantId;
    return true;
  }
}
