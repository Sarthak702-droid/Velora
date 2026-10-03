import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { VeloraRequest } from '../middleware/context.middleware';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<VeloraRequest>();

    const requestId = request?.requestId || 'req_unknown';
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Unable to process request';
    let errorType = 'InternalServerError';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const obj = res as any;
        message = obj.message || message;
        errorType = obj.error || errorType;
      }
    } else if (exception instanceof Error) {
      // Internal error or Prisma error: Never expose SQL / DB internals in response
      this.logger.error(
        JSON.stringify({
          event: 'UNHANDLED_EXCEPTION',
          requestId,
          path: request?.url,
          method: request?.method,
          tenantId: request?.tenantId,
          error: exception.message,
          stack: exception.stack,
        }),
      );
      message = 'An unexpected server error occurred. Please contact support with your Request ID.';
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      error: errorType,
      message,
      requestId,
      timestamp: new Date().toISOString(),
    });
  }
}
