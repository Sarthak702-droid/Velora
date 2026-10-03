import { Controller, Get, Post, Patch, Body, Param } from '@nestjs/common';
import { BranchesService } from './branches.service';
import { Roles, RequireFeature } from '../common/decorators/metadata.decorator';
import { CurrentTenant } from '../common/decorators/current.decorator';
import { UserRole } from '@prisma/client';

@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  async getBranches(@CurrentTenant() tenantId: string) {
    return this.branchesService.getBranches(tenantId);
  }

  @Get(':id')
  async getBranchById(
    @CurrentTenant() tenantId: string,
    @Param('id') branchId: string,
  ) {
    return this.branchesService.getBranchById(tenantId, branchId);
  }

  @Post()
  @Roles(UserRole.SALON_OWNER, UserRole.PLATFORM_ADMIN)
  @RequireFeature('branch.multi')
  async createBranch(
    @CurrentTenant() tenantId: string,
    @Body() data: any,
  ) {
    return this.branchesService.createBranch(tenantId, data);
  }

  @Patch(':id')
  @Roles(UserRole.SALON_OWNER, UserRole.BRANCH_MANAGER)
  async updateBranch(
    @CurrentTenant() tenantId: string,
    @Param('id') branchId: string,
    @Body() data: any,
  ) {
    return this.branchesService.updateBranch(tenantId, branchId, data);
  }
}
