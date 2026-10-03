import { Controller, Get, Patch, Body, Param } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { Public, Roles } from '../common/decorators/metadata.decorator';
import { CurrentTenant } from '../common/decorators/current.decorator';
import { UserRole } from '@prisma/client';

@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Public()
  @Get('public/:slug')
  async getPublicSalon(@Param('slug') slug: string) {
    return this.tenantsService.getSalonBySlug(slug);
  }

  @Get('profile')
  @Roles(UserRole.SALON_OWNER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST)
  async getProfile(@CurrentTenant() tenantId: string) {
    return this.tenantsService.getProfile(tenantId);
  }

  @Patch('profile')
  @Roles(UserRole.SALON_OWNER)
  async updateProfile(@CurrentTenant() tenantId: string, @Body() data: any) {
    return this.tenantsService.updateProfile(tenantId, data);
  }
}
