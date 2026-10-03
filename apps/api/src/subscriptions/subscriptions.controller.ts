import { Controller, Get } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { Public, Roles } from '../common/decorators/metadata.decorator';
import { CurrentTenant } from '../common/decorators/current.decorator';
import { UserRole } from '@prisma/client';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Public()
  @Get('plans')
  async getPlans() {
    return this.subscriptionsService.getPlans();
  }

  @Get('current')
  @Roles(UserRole.SALON_OWNER, UserRole.BRANCH_MANAGER, UserRole.PLATFORM_ADMIN)
  async getCurrentSubscription(@CurrentTenant() tenantId: string) {
    return this.subscriptionsService.getCurrentSubscription(tenantId);
  }
}
