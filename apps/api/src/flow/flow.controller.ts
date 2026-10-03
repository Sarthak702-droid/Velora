import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { FlowService } from './flow.service';
import { EtaEngineService } from './eta-engine.service';
import { Roles, RequireFeature } from '../common/decorators/metadata.decorator';
import { CurrentTenant, CurrentUser } from '../common/decorators/current.decorator';
import { UserRole } from '@prisma/client';

@Controller('flow')
export class FlowController {
  constructor(
    private readonly flowService: FlowService,
    private readonly etaEngine: EtaEngineService,
  ) {}

  @Get('timeline')
  @Roles(UserRole.SALON_OWNER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST, UserRole.PROFESSIONAL)
  @RequireFeature('flow.unified')
  async getUnifiedTimeline(
    @CurrentTenant() tenantId: string,
    @Query('branchId') branchId: string,
    @Query('date') dateStr?: string,
  ) {
    return this.flowService.getUnifiedTimeline(tenantId, branchId, dateStr);
  }

  @Post('check-in/:appointmentId')
  @Roles(UserRole.SALON_OWNER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST)
  async checkInAppointment(
    @CurrentTenant() tenantId: string,
    @Param('appointmentId') appointmentId: string,
    @CurrentUser() user: any,
  ) {
    return this.flowService.checkInAppointment(
      tenantId,
      appointmentId,
      user.id,
      user.name,
      user.role,
    );
  }

  @Get('eta/:queueEntryId')
  async getQueueEta(
    @CurrentTenant() tenantId: string,
    @Param('queueEntryId') queueEntryId: string,
    @Query('branchId') branchId: string,
  ) {
    return this.etaEngine.calculateQueueEta(tenantId, branchId, queueEntryId);
  }

  @Patch('reassign')
  @Roles(UserRole.SALON_OWNER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST)
  async reassignStylist(
    @CurrentTenant() tenantId: string,
    @Body('queueEntryId') queueEntryId: string,
    @Body('staffId') newStaffId: string,
    @Body('reason') reason: string,
    @CurrentUser() user: any,
  ) {
    return this.flowService.reassignStylist(
      tenantId,
      queueEntryId,
      newStaffId,
      reason,
      user.id,
      user.name,
      user.role,
    );
  }
}
