import { Controller, Get, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { Roles, RequireFeature } from '../common/decorators/metadata.decorator';
import { CurrentTenant } from '../common/decorators/current.decorator';
import { UserRole } from '@prisma/client';

@Controller('analytics')
@Roles(UserRole.SALON_OWNER, UserRole.BRANCH_MANAGER)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @RequireFeature('insights.basic')
  async getDashboard(
    @CurrentTenant() tenantId: string,
    @Query('branchId') branchId?: string,
    @Query('date') dateStr?: string,
  ) {
    return this.analyticsService.getDashboardKpis(tenantId, branchId, dateStr);
  }
}
