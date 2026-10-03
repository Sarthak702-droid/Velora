import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateAuditLogParams {
  tenantId?: string;
  branchId?: string;
  actorId?: string;
  actorName?: string;
  actorRole?: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: any;
  after?: any;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(params: CreateAuditLogParams) {
    try {
      const record = await this.prisma.auditLog.create({
        data: {
          tenantId: params.tenantId,
          branchId: params.branchId,
          actorId: params.actorId,
          actorName: params.actorName,
          actorRole: params.actorRole,
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId,
          before: params.before ? (params.before as any) : undefined,
          after: params.after ? (params.after as any) : undefined,
          reason: params.reason,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          requestId: params.requestId,
        },
      });

      this.logger.log(
        JSON.stringify({
          auditEvent: params.action,
          tenantId: params.tenantId,
          actor: params.actorName || params.actorId || 'system',
          entity: `${params.entityType}:${params.entityId}`,
          reason: params.reason,
        }),
      );

      return record;
    } catch (err: any) {
      this.logger.error(`Failed to record audit log: ${err.message}`);
    }
  }

  async getLogs(tenantId: string, query: { limit?: number; offset?: number; action?: string }) {
    const limit = Math.min(query.limit || 50, 100);
    const offset = query.offset || 0;

    const where: any = { tenantId };
    if (query.action) {
      where.action = query.action;
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { logs, total, limit, offset };
  }
}
