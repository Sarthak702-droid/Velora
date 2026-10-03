import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Headers,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import {
  CreateBookingRequestDto,
  CancelBookingDto,
  RescheduleBookingDto,
} from './dto/bookings.dto';
import { Public, Roles, RequireFeature } from '../common/decorators/metadata.decorator';
import { CurrentTenant, CurrentUser } from '../common/decorators/current.decorator';
import { IdempotencyService } from '../security/idempotency.service';
import { AppointmentStatus, UserRole } from '@prisma/client';

@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  @Public()
  @Get('availability')
  async getAvailability(
    @CurrentTenant() tenantId: string,
    @Query('branchId') branchId: string,
    @Query('serviceIds') serviceIdsStr: string,
    @Query('date') dateStr: string,
    @Query('staffId') staffId?: string,
  ) {
    const serviceIds = serviceIdsStr ? serviceIdsStr.split(',') : [];
    return this.bookingsService.getAvailability(
      tenantId,
      branchId,
      serviceIds,
      dateStr,
      staffId,
    );
  }

  @Public()
  @Post()
  @RequireFeature('book.advance')
  async createBooking(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateBookingRequestDto,
    @CurrentUser() user: any,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    // Check idempotency if key provided
    if (idempotencyKey) {
      const check = await this.idempotencyService.checkOrRecord(
        idempotencyKey,
        'POST',
        '/bookings',
      );
      if (check.isExisting) {
        return check.response;
      }
    }

    const booking = await this.bookingsService.createBooking(
      tenantId,
      dto,
      user?.id,
      user?.role || 'CUSTOMER',
    );

    if (idempotencyKey) {
      await this.idempotencyService.saveResponse(
        idempotencyKey,
        'POST',
        '/bookings',
        201,
        booking,
      );
    }

    return booking;
  }

  @Get()
  @Roles(UserRole.SALON_OWNER, UserRole.BRANCH_MANAGER, UserRole.RECEPTIONIST, UserRole.PROFESSIONAL)
  async getAppointments(
    @CurrentTenant() tenantId: string,
    @Query('branchId') branchId: string,
    @Query('date') dateStr?: string,
    @Query('staffId') staffId?: string,
    @Query('status') status?: AppointmentStatus,
  ) {
    return this.bookingsService.getAppointments(tenantId, branchId, {
      dateStr,
      staffId,
      status,
    });
  }

  @Public()
  @Get(':id')
  async getAppointmentById(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.bookingsService.getAppointmentById(tenantId, id);
  }

  @Patch(':id/cancel')
  async cancelAppointment(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
    @CurrentUser() user: any,
  ) {
    return this.bookingsService.cancelAppointment(
      tenantId,
      id,
      dto.reason,
      user?.id,
      user?.role || 'CUSTOMER',
    );
  }

  @Patch(':id/reschedule')
  async rescheduleAppointment(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: RescheduleBookingDto,
    @CurrentUser() user: any,
  ) {
    return this.bookingsService.rescheduleAppointment(
      tenantId,
      id,
      dto.dateStr,
      dto.timeStr,
      user?.id,
      user?.role || 'CUSTOMER',
    );
  }
}
