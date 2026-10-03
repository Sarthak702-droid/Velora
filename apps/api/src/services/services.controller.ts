import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { ServicesService } from './services.service';
import { Public, Roles } from '../common/decorators/metadata.decorator';
import { CurrentTenant } from '../common/decorators/current.decorator';
import { UserRole } from '@prisma/client';

@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Public()
  @Get('categories')
  async getCategories(@CurrentTenant() tenantId: string) {
    return this.servicesService.getCategories(tenantId);
  }

  @Public()
  @Get()
  async getServices(
    @CurrentTenant() tenantId: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.servicesService.getServices(tenantId, categoryId);
  }

  @Public()
  @Get(':id')
  async getServiceById(
    @CurrentTenant() tenantId: string,
    @Param('id') serviceId: string,
  ) {
    return this.servicesService.getServiceById(tenantId, serviceId);
  }

  @Post()
  @Roles(UserRole.SALON_OWNER, UserRole.BRANCH_MANAGER)
  async createService(
    @CurrentTenant() tenantId: string,
    @Body() data: any,
  ) {
    return this.servicesService.createService(tenantId, data);
  }

  @Patch(':id')
  @Roles(UserRole.SALON_OWNER, UserRole.BRANCH_MANAGER)
  async updateService(
    @CurrentTenant() tenantId: string,
    @Param('id') serviceId: string,
    @Body() data: any,
  ) {
    return this.servicesService.updateService(tenantId, serviceId, data);
  }
}
