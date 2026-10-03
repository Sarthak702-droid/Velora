import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { VeloraRequest } from '../middleware/context.middleware';

export interface ResponseEnvelope<T> {
  success: boolean;
  statusCode: number;
  data: T;
  requestId: string;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ResponseEnvelope<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ResponseEnvelope<T>> {
    const req = context.switchToHttp().getRequest<VeloraRequest>();
    const res = context.switchToHttp().getResponse();

    return next.handle().pipe(
      map((data) => ({
        success: true,
        statusCode: res.statusCode || 200,
        data,
        requestId: req?.requestId || 'req_auto',
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
