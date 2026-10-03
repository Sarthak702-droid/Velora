import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { VeloraRequest } from '../middleware/context.middleware';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<VeloraRequest>();
    const startTime = Date.now();
    const { method, url, requestId, tenantId, branchId, user } = req;

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const logPayload = {
            event: 'HTTP_REQUEST_COMPLETED',
            requestId,
            method,
            path: url,
            tenantId: tenantId || user?.tenantId,
            branchId: branchId || user?.branchId,
            userId: user?.id,
            role: user?.role,
            durationMs: duration,
            timestamp: new Date().toISOString(),
          };
          this.logger.log(JSON.stringify(logPayload));
        },
        error: (err) => {
          const duration = Date.now() - startTime;
          const logPayload = {
            event: 'HTTP_REQUEST_FAILED',
            requestId,
            method,
            path: url,
            tenantId: tenantId || user?.tenantId,
            branchId: branchId || user?.branchId,
            userId: user?.id,
            error: err.message,
            durationMs: duration,
            timestamp: new Date().toISOString(),
          };
          this.logger.warn(JSON.stringify(logPayload));
        },
      }),
    );
  }
}
