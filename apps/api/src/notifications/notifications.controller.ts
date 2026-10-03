import { Controller, Get, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { Roles, RequireFeature } from '../common/decorators/metadata.decorator';
import { CurrentTenant } from '../common/decorators/current.decorator';
import { UserRole } from '@prisma/client';

@Controller('notifications')
@Roles(UserRole.SALON_OWNER, UserRole.BRANCH_MANAGER)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @RequireFeature('notify.whatsapp')
  async getNotifications(
    @CurrentTenant() tenantId: string,
    @Query('limit') limit?: number,
  ) {
    return this.notificationsService.getTenantNotifications(tenantId, limit);
  }
}
