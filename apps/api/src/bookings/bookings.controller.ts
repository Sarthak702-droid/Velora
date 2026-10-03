import { createHash } from "crypto";
import { ReceiptService } from "../security/receipt.service";
import { VeloraRequest } from "../common/middleware/context.middleware";
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Headers,
  Req,
  ForbiddenException,
} from "@nestjs/common";
import { BookingsService } from "./bookings.service";
import {
  CreateBookingRequestDto,
  CancelBookingDto,
  RescheduleBookingDto,
} from "./dto/bookings.dto";
import {
  Public,
  Roles,
  RequireFeature,
} from "../common/decorators/metadata.decorator";
import {
  CurrentTenant,
  CurrentUser,
} from "../common/decorators/current.decorator";
import { IdempotencyService } from "../security/idempotency.service";
import { AppointmentStatus, UserRole } from "@prisma/client";

@Controller("bookings")
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly receipts: ReceiptService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  @Public()
  @Get("availability")
  async getAvailability(
    @CurrentTenant() tenantId: string,
    @Query("branchId") branchId: string,
    @Query("serviceIds") serviceIdsStr: string,
    @Query("date") dateStr: string,
    @Query("staffId") staffId?: string,
  ) {
    const serviceIds = serviceIdsStr ? serviceIdsStr.split(",") : [];
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
  @RequireFeature("book.advance")
  async createBooking(
    @CurrentTenant() tenantId: string,
    @Body() dto: CreateBookingRequestDto,
    @CurrentUser() user: any,
    @Headers("x-idempotency-key") idempotencyKey?: string,
  ) {
    if (idempotencyKey)
      idempotencyKey = `${tenantId}:${createHash("sha256")
        .update(idempotencyKey + JSON.stringify(dto))
        .digest("hex")}`;
    // Scope cached responses to the tenant and exact booking request.
    if (idempotencyKey) {
      const check = await this.idempotencyService.checkOrRecord(
        idempotencyKey,
        "POST",
        "/bookings",
      );
      if (check.isExisting) {
        const existing = check.response as { id: string };
        return {
          ...existing,
          managementReceipt: this.receipts.issue(
            "booking",
            tenantId,
            existing.id,
          ),
        };
      }
    }

    const booking = await this.bookingsService.createBooking(
      tenantId,
      dto,
      user?.id,
      user?.role || "CUSTOMER",
    );

    if (idempotencyKey) {
      await this.idempotencyService.saveResponse(
        idempotencyKey,
        "POST",
        "/bookings",
        201,
        booking,
      );
    }

    return {
      ...booking,
      managementReceipt: this.receipts.issue("booking", tenantId, booking.id),
    };
  }

  @Get()
  @Roles(
    UserRole.SALON_OWNER,
    UserRole.BRANCH_MANAGER,
    UserRole.RECEPTIONIST,
    UserRole.PROFESSIONAL,
  )
  async getAppointments(
    @CurrentTenant() tenantId: string,
    @Query("branchId") branchId: string,
    @Query("date") dateStr?: string,
    @Query("staffId") staffId?: string,
    @Query("status") status?: AppointmentStatus,
  ) {
    return this.bookingsService.getAppointments(tenantId, branchId, {
      dateStr,
      staffId,
      status,
    });
  }

  @Public()
  @Get(":id/availability")
  async getRescheduleAvailability(
    @CurrentTenant() tenantId: string,
    @Param("id") id: string,
    @Query("date") date: string,
    @Req() req: VeloraRequest,
  ) {
    await this.authorize(tenantId, id, req);
    const booking = await this.bookingsService.getAppointmentById(tenantId, id);
    return this.bookingsService.getAvailability(
      tenantId,
      booking.branchId,
      booking.services.map((s) => s.serviceId),
      date,
      booking.staffId || undefined,
      id,
    );
  }

  @Public()
  @Get(":id")
  async getAppointmentById(
    @CurrentTenant() tenantId: string,
    @Param("id") id: string,
    @Req() req: VeloraRequest,
  ) {
    await this.authorize(tenantId, id, req);
    return this.bookingsService.getAppointmentById(tenantId, id);
  }

  @Public()
  @Patch(":id/cancel")
  async cancelAppointment(
    @CurrentTenant() tenantId: string,
    @Param("id") id: string,
    @Req() req: VeloraRequest,
    @Body() dto: CancelBookingDto,
    @CurrentUser() user: any,
  ) {
    await this.authorize(tenantId, id, req);
    return this.bookingsService.cancelAppointment(
      tenantId,
      id,
      dto.reason,
      user?.id,
      user?.role || "CUSTOMER",
    );
  }

  @Public()
  @Patch(":id/reschedule")
  async rescheduleAppointment(
    @CurrentTenant() tenantId: string,
    @Param("id") id: string,
    @Req() req: VeloraRequest,
    @Body() dto: RescheduleBookingDto,
    @CurrentUser() user: any,
  ) {
    await this.authorize(tenantId, id, req);
    return this.bookingsService.rescheduleAppointment(
      tenantId,
      id,
      dto.dateStr,
      dto.timeStr,
      user?.id,
      user?.role || "CUSTOMER",
    );
  }
  private async authorize(tenantId: string, id: string, req: VeloraRequest) {
    const booking = await this.bookingsService.getAppointmentById(tenantId, id);
    const user = req.user;
    if (user?.tenantId === tenantId) {
      if (user.role === "CUSTOMER" && user.id === booking.customerId) return;
      if (
        ["SALON_OWNER", "BRANCH_MANAGER", "RECEPTIONIST"].includes(user.role)
      ) {
        if (user.role !== "SALON_OWNER" && user.branchId !== booking.branchId)
          throw new ForbiddenException("Branch access denied");
        return;
      }
    }
    this.receipts.verify(
      "booking",
      tenantId,
      id,
      req.headers["x-private-receipt"] as string,
    );
  }
}
