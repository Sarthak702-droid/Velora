import { Controller, Get, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuditService } from './audit.service';
import { Roles } from '../common/decorators/metadata.decorator';
import { CurrentTenant } from '../common/decorators/current.decorator';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles(UserRole.SALON_OWNER, UserRole.PLATFORM_ADMIN)
  async getLogs(
    @CurrentTenant() tenantId: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('action') action?: string,
  ) {
    return this.auditService.getLogs(tenantId, { limit, offset, action });
  }
}
