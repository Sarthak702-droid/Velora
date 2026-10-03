import { Controller, Get, Patch, Body, Param, Query } from '@nestjs/common';
import { StaffService } from './staff.service';
import { Public, Roles } from '../common/decorators/metadata.decorator';
import { CurrentTenant } from '../common/decorators/current.decorator';
import { UserRole, OperationalStatus } from '@prisma/client';

@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Public()
  @Get()
  async getStaff(
    @CurrentTenant() tenantId: string,
    @Query('serviceId') serviceId?: string,
  ) {
    return this.staffService.getStaff(tenantId, serviceId);
  }

  @Public()
  @Get(':id')
  async getStaffById(
    @CurrentTenant() tenantId: string,
    @Param('id') staffId: string,
  ) {
    return this.staffService.getStaffById(tenantId, staffId);
  }

  @Patch(':id/status')
  @Roles(UserRole.SALON_OWNER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST, UserRole.PROFESSIONAL)
  async updateStatus(
    @CurrentTenant() tenantId: string,
    @Param('id') staffId: string,
    @Body('status') status: OperationalStatus,
    @Body('branchId') branchId?: string,
  ) {
    return this.staffService.updateOperationalStatus(tenantId, staffId, status, branchId);
  }
}
