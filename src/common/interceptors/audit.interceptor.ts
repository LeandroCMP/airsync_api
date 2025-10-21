import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor
} from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { AuditService, AuditEntry } from '../../core/audit/audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    return next.handle().pipe(
      mergeMap((data) =>
        from(
          (async () => {
            if (data && typeof data === 'object' && data._audit) {
              const audit: AuditEntry = {
                tenantId: data._audit.tenantId || request.tenantId,
                entity: data._audit.entity,
                entityId: data._audit.entityId,
                action: data._audit.action,
                before: data._audit.before,
                after: data._audit.after,
                by: data._audit.by || request.user?.id,
                ip: request.ip
              };
              await this.auditService.log(audit);
              const clone = { ...data };
              delete clone._audit;
              return clone;
            }
            return data;
          })()
        )
      )
    );
  }
}
