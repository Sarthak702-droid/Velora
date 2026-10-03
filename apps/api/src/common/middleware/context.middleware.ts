import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export interface VeloraRequest extends Request {
  requestId: string;
  tenantId?: string;
  branchId?: string;
  user?: any;
}

@Injectable()
export class ContextMiddleware implements NestMiddleware {
  use(req: VeloraRequest, res: Response, next: NextFunction) {
    // 1. Generate or forward request ID for distributed tracing & structured logging
    const incomingRequestId = req.headers['x-request-id'] as string;
    const requestId = incomingRequestId || `req_${randomUUID().replace(/-/g, '')}`;
    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    // 2. Extract tenant ID from header, query or subdomain
    const headerTenant = req.headers['x-tenant-id'] as string;
    const queryTenant = req.query.tenantId as string;
    if (headerTenant) {
      req.tenantId = headerTenant;
    } else if (queryTenant) {
      req.tenantId = queryTenant;
    }

    // 3. Extract branch ID if present
    const headerBranch = req.headers['x-branch-id'] as string;
    const queryBranch = req.query.branchId as string;
    if (headerBranch) {
      req.branchId = headerBranch;
    } else if (queryBranch) {
      req.branchId = queryBranch;
    }

    next();
  }
}
