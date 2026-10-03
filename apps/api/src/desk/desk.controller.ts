import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
} from '@nestjs/common';
import { DeskService } from './desk.service';
import { Roles, RequireFeature } from '../common/decorators/metadata.decorator';
import { CurrentTenant, CurrentUser } from '../common/decorators/current.decorator';
import { UserRole } from '@prisma/client';

@Controller('desk')
@Roles(UserRole.SALON_OWNER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST, UserRole.PROFESSIONAL)
export class DeskController {
  constructor(private readonly deskService: DeskService) {}

  @Get('overview')
  @RequireFeature('desk.reception')
  async getDeskOverview(
    @CurrentTenant() tenantId: string,
    @Query('branchId') branchId: string,
  ) {
    return this.deskService.getDeskOverview(tenantId, branchId);
  }

  @Get('search')
  async globalSearch(
    @CurrentTenant() tenantId: string,
    @Query('branchId') branchId: string,
    @Query('q') query: string,
  ) {
    return this.deskService.globalSearch(tenantId, branchId, query);
  }

  @Post('start-service/:id')
  async startService(
    @CurrentTenant() tenantId: string,
    @Param('id') queueEntryId: string,
    @Body('staffId') staffId: string,
    @CurrentUser() user: any,
  ) {
    return this.deskService.startService(
      tenantId,
      queueEntryId,
      staffId,
      user.id,
      user.name,
      user.role,
    );
  }

  @Post('complete-service/:id')
  async completeService(
    @CurrentTenant() tenantId: string,
    @Param('id') queueEntryId: string,
    @CurrentUser() user: any,
  ) {
    return this.deskService.completeService(
      tenantId,
      queueEntryId,
      user.id,
      user.name,
      user.role,
    );
  }

  @Post('no-show/:id')
  async markNoShow(
    @CurrentTenant() tenantId: string,
    @Param('id') appointmentId: string,
    @CurrentUser() user: any,
  ) {
    return this.deskService.markNoShow(
      tenantId,
      appointmentId,
      user.id,
      user.name,
      user.role,
    );
  }
}
