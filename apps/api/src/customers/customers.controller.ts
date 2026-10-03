import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { Roles } from '../common/decorators/metadata.decorator';
import { CurrentTenant } from '../common/decorators/current.decorator';
import { UserRole } from '@prisma/client';

@Controller('customers')
@Roles(UserRole.SALON_OWNER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  async getCustomers(
    @CurrentTenant() tenantId: string,
    @Query('search') search?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.customersService.getCustomers(tenantId, { search, limit, offset });
  }

  @Get(':id')
  async getCustomerById(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.customersService.getCustomerById(tenantId, id);
  }

  @Get(':id/quick-rebook')
  async getQuickRebookData(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.customersService.getQuickRebookData(tenantId, id);
  }

  @Patch(':id/notes')
  async updateNotes(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body('notes') notes: string,
  ) {
    return this.customersService.updateCustomerNotes(tenantId, id, notes);
  }
}
