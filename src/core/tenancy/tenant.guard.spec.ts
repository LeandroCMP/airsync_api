import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantGuard } from './tenant.guard';

describe('TenantGuard', () => {
  const reflector = new Reflector();
  const guard = new TenantGuard(reflector);

  const createContext = (headers: Record<string, string> = {}) => ({
    switchToHttp: () => ({
      getRequest: () => ({ headers })
    }),
    getHandler: () => ({}),
    getClass: () => ({})
  }) as unknown as ExecutionContext;

  it('throws when header missing', () => {
    expect(() => guard.canActivate(createContext())).toThrow(ForbiddenException);
  });

  it('allows when header present', () => {
    const context = createContext({ 'x-tenant-id': 'demo' });
    expect(guard.canActivate(context)).toBe(true);
  });
});
