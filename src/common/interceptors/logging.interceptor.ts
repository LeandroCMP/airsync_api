import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const { method, originalUrl } = req;
    const tenant = req.headers['x-tenant-id'] || '-';
    const user = req.user?.id || '-';
    const start = Date.now();
    this.logger.log(`Inicio | ${method} ${originalUrl} | tenant=${tenant} user=${user}`);
    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - start;
          this.logger.log(`Fim | ${method} ${originalUrl} | tenant=${tenant} user=${user} tempo=${ms}ms`);
        },
        error: (err) => {
          const ms = Date.now() - start;
          this.logger.error(
            `Erro | ${method} ${originalUrl} | tenant=${tenant} user=${user} tempo=${ms}ms | msg=${err?.message}`
          );
        }
      })
    );
  }
}
