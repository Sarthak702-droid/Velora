import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DynamicSlotEngine } from './dynamic-slot.engine';
import { EventsGateway } from '../events/events.gateway';
import { AuditService } from '../audit/audit.service';
import { AppointmentStatus, UserRole } from '@prisma/client';

export interface CreateBookingDto {
  branchId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  serviceIds: string[];
  dateStr: string; // YYYY-MM-DD
  timeStr: string; // HH:mm
  staffId?: string; // specific stylist or 'any'
  notes?: string;
}

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly slotEngine: DynamicSlotEngine,
    private readonly eventsGateway: EventsGateway,
    private readonly auditService: AuditService,
  ) {}

  async getAvailability(
    tenantId: string,
    branchId: string,
    serviceIds: string[],
    dateStr: string,
    staffId?: string,
  ) {
    return this.slotEngine.calculateAvailableSlots({
      tenantId,
      branchId,
      serviceIds,
      dateStr,
      staffId,
    });
  }

  async createBooking(tenantId: string, dto: CreateBookingDto, actorId?: string, actorRole?: string) {
    const { branchId, serviceIds, dateStr, timeStr } = dto;
    const cleanPhone = dto.customerPhone.trim().replace(/\s+/g, '');

    // 1. Fetch requested services
    const services = await this.prisma.service.findMany({
      where: { id: { in: serviceIds }, tenantId, active: true },
    });

    if (services.length !== serviceIds.length) {
      throw new BadRequestException('One or more selected services are unavailable');
    }

    const totalDuration = services.reduce((sum, s) => sum + s.duration, 0);
    const totalBuffer = Math.max(...services.map((s) => s.buffer), 5);
    const totalPrice = services.reduce((sum, s) => sum + s.price, 0);

    const bookingDate = new Date(`${dateStr}T00:00:00.000Z`);
    const startTime = new Date(`${dateStr}T${timeStr}:00.000Z`);
    const endTime = new Date(startTime.getTime() + (totalDuration + totalBuffer) * 60 * 1000);

    // 2. Concurrency Safety: Check available slots in real-time
    const availableSlots = await this.slotEngine.calculateAvailableSlots({
      tenantId,
      branchId,
      serviceIds,
      dateStr,
      staffId: dto.staffId,
    });

    const matchingSlot = availableSlots.find((s) => s.time === timeStr);
    if (!matchingSlot) {
      const alternatives = availableSlots.slice(0, 3).map((s) => s.time);
      throw new ConflictException({
        message: 'That slot was just booked or is unavailable.',
        closestAvailable: alternatives,
      });
    }

    const assignedStaffId = matchingSlot.staffId;

    // 3. Atomic Database Transaction: Reserve customer, appointment, services and history
    const result = await this.prisma.$transaction(async (tx) => {
      // Re-verify no overlapping appointment exists for this staff inside transaction
      const overlap = await tx.appointment.findFirst({
        where: {
          tenantId,
          staffId: assignedStaffId,
          date: bookingDate,
          status: { in: ['CONFIRMED', 'CHECKED_IN', 'IN_SERVICE', 'WAITING'] },
          OR: [
            {
              startTime: { lt: endTime },
              endTime: { gt: startTime },
            },
          ],
        },
      });

      if (overlap) {
        throw new ConflictException({
          message: 'That slot was just booked by another customer.',
          closestAvailable: availableSlots.filter((s) => s.time !== timeStr).slice(0, 3).map((s) => s.time),
        });
      }

      // Upsert Customer
      let customer = await tx.customer.findUnique({
        where: {
          tenantId_phone: {
            tenantId,
            phone: cleanPhone,
          },
        },
      });

      if (!customer) {
        customer = await tx.customer.create({
          data: {
            tenantId,
            name: dto.customerName,
            phone: cleanPhone,
            email: dto.customerEmail,
            preferredStaffId: assignedStaffId,
            totalVisits: 1,
            lastVisitAt: startTime,
          },
        });
      } else {
        customer = await tx.customer.update({
          where: { id: customer.id },
          data: {
            name: dto.customerName || customer.name,
            email: dto.customerEmail || customer.email,
            preferredStaffId: assignedStaffId,
            totalVisits: { increment: 1 },
            lastVisitAt: startTime,
          },
        });
      }

      // Create Appointment
      const appointment = await tx.appointment.create({
        data: {
          tenantId,
          branchId,
          customerId: customer.id,
          staffId: assignedStaffId,
          date: bookingDate,
          startTime,
          endTime,
          totalDuration,
          totalBuffer,
          totalPrice,
          status: AppointmentStatus.CONFIRMED,
          notes: dto.notes,
          services: {
            create: services.map((s) => ({
              serviceId: s.id,
              price: s.price,
              duration: s.duration,
              buffer: s.buffer,
            })),
          },
          history: {
            create: {
              fromStatus: null,
              toStatus: AppointmentStatus.CONFIRMED,
              actorId,
              actorRole: actorRole || 'CUSTOMER',
              reason: 'Advance booking created',
            },
          },
        },
        include: {
          customer: true,
          staff: true,
          services: {
            include: { service: true },
          },
        },
      });

      return appointment;
    });

    // 4. Audit Log & Real-time Notification
    await this.auditService.log({
      tenantId,
      branchId,
      actorId,
      actorRole: actorRole || 'CUSTOMER',
      action: 'BOOKING_CREATED',
      entityType: 'Appointment',
      entityId: result.id,
      after: {
        startTime: result.startTime,
        staffId: result.staffId,
        customerName: dto.customerName,
        totalPrice: result.totalPrice,
      },
    });

    this.eventsGateway.broadcastTimelineUpdated(branchId, {
      type: 'BOOKING_CREATED',
      appointmentId: result.id,
      staffId: assignedStaffId,
    });

    return result;
  }

  async getAppointments(
    tenantId: string,
    branchId: string,
    query: { dateStr?: string; staffId?: string; status?: AppointmentStatus },
  ) {
    const where: any = { tenantId, branchId };

    if (query.dateStr) {
      where.date = new Date(`${query.dateStr}T00:00:00.000Z`);
    }
    if (query.staffId) {
      where.staffId = query.staffId;
    }
    if (query.status) {
      where.status = query.status;
    }

    return this.prisma.appointment.findMany({
      where,
      include: {
        customer: true,
        staff: true,
        services: {
          include: { service: true },
        },
      },
      orderBy: { startTime: 'asc' },
    });
  }

  async getAppointmentById(tenantId: string, id: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, tenantId },
      include: {
        customer: true,
        staff: true,
        services: {
          include: { service: true },
        },
        history: {
          orderBy: { timestamp: 'desc' },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    return appointment;
  }

  async cancelAppointment(
    tenantId: string,
    id: string,
    reason: string,
    actorId?: string,
    actorRole?: string,
  ) {
    const appointment = await this.getAppointmentById(tenantId, id);

    if (
      appointment.status === AppointmentStatus.COMPLETED ||
      appointment.status === AppointmentStatus.CANCELLED
    ) {
      throw new BadRequestException(`Cannot cancel appointment with status ${appointment.status}`);
    }

    // Cancellation window check (if customer is cancelling)
    if (actorRole === 'CUSTOMER') {
      const profile = await this.prisma.salonProfile.findUnique({ where: { tenantId } });
      const windowHours = profile?.cancellationWindowHours || 2;
      const minCancelTime = new Date(Date.now() + windowHours * 60 * 60 * 1000);
      if (appointment.startTime < minCancelTime) {
        throw new ForbiddenException(
          `Cancellations are only allowed up to ${windowHours} hours before the appointment. Please call the salon directly.`,
        );
      }
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        status: AppointmentStatus.CANCELLED,
        cancellationReason: reason,
        history: {
          create: {
            fromStatus: appointment.status,
            toStatus: AppointmentStatus.CANCELLED,
            actorId,
            actorRole: actorRole || 'RECEPTIONIST',
            reason,
          },
        },
      },
    });

    await this.auditService.log({
      tenantId,
      branchId: appointment.branchId,
      actorId,
      actorRole,
      action: 'BOOKING_CANCELLED',
      entityType: 'Appointment',
      entityId: id,
      before: { status: appointment.status },
      after: { status: AppointmentStatus.CANCELLED, reason },
      reason,
    });

    this.eventsGateway.broadcastTimelineUpdated(appointment.branchId, {
      type: 'BOOKING_CANCELLED',
      appointmentId: id,
    });

    return updated;
  }

  async rescheduleAppointment(
    tenantId: string,
    id: string,
    newDateStr: string,
    newTimeStr: string,
    actorId?: string,
    actorRole?: string,
  ) {
    const appointment = await this.getAppointmentById(tenantId, id);
    const serviceIds = appointment.services.map((s) => s.serviceId);

    // Check availability at new time
    const availableSlots = await this.slotEngine.calculateAvailableSlots({
      tenantId,
      branchId: appointment.branchId,
      serviceIds,
      dateStr: newDateStr,
      staffId: appointment.staffId || undefined,
    });

    const matchingSlot = availableSlots.find((s) => s.time === newTimeStr);
    if (!matchingSlot) {
      throw new ConflictException('The requested reschedule slot is not available');
    }

    const newDate = new Date(`${newDateStr}T00:00:00.000Z`);
    const newStart = new Date(`${newDateStr}T${newTimeStr}:00.000Z`);
    const newEnd = new Date(newStart.getTime() + (appointment.totalDuration + appointment.totalBuffer) * 60 * 1000);

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        date: newDate,
        startTime: newStart,
        endTime: newEnd,
        staffId: matchingSlot.staffId,
        history: {
          create: {
            fromStatus: appointment.status,
            toStatus: appointment.status,
            actorId,
            actorRole,
            reason: `Rescheduled from ${appointment.startTime.toISOString()} to ${newStart.toISOString()}`,
          },
        },
      },
    });

    await this.auditService.log({
      tenantId,
      branchId: appointment.branchId,
      actorId,
      actorRole,
      action: 'BOOKING_RESCHEDULED',
      entityType: 'Appointment',
      entityId: id,
      before: { startTime: appointment.startTime },
      after: { startTime: newStart },
    });

    this.eventsGateway.broadcastTimelineUpdated(appointment.branchId, {
      type: 'BOOKING_RESCHEDULED',
      appointmentId: id,
    });

    return updated;
  }
}
