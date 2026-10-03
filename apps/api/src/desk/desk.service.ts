import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueueStatus, AppointmentStatus } from '@prisma/client';
import { EventsGateway } from '../events/events.gateway';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class DeskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Fast Three-Column Desk Overview: WAITING, IN SERVICE, UPCOMING
   */
  async getDeskOverview(tenantId: string, branchId: string) {
    const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z');

    // 1. In Service
    const inServiceEntries = await this.prisma.queueEntry.findMany({
      where: {
        tenantId,
        branchId,
        status: QueueStatus.IN_SERVICE,
      },
      include: {
        customer: true,
        staff: true,
      },
      orderBy: { serviceStartAt: 'asc' },
    });

    // 2. Waiting
    const waitingEntries = await this.prisma.queueEntry.findMany({
      where: {
        tenantId,
        branchId,
        status: { in: [QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.CHECKED_IN] },
      },
      include: {
        customer: true,
        staff: true,
      },
      orderBy: { position: 'asc' },
    });

    // 3. Upcoming Bookings for Today (Not yet checked in)
    const upcomingBookings = await this.prisma.appointment.findMany({
      where: {
        tenantId,
        branchId,
        date: today,
        status: AppointmentStatus.CONFIRMED,
      },
      include: {
        customer: true,
        staff: true,
        services: { include: { service: true } },
      },
      orderBy: { startTime: 'asc' },
    });

    // Fetch services lookup
    const allServiceIds = Array.from(
      new Set([
        ...inServiceEntries.flatMap((e) => e.serviceIds),
        ...waitingEntries.flatMap((e) => e.serviceIds),
      ]),
    );

    const services = await this.prisma.service.findMany({
      where: { id: { in: allServiceIds } },
    });
    const serviceMap = new Map(services.map((s) => [s.id, s]));

    return {
      inService: inServiceEntries.map((e) => ({
        ...e,
        services: e.serviceIds.map((id) => serviceMap.get(id)).filter(Boolean),
      })),
      waiting: waitingEntries.map((e) => ({
        ...e,
        services: e.serviceIds.map((id) => serviceMap.get(id)).filter(Boolean),
      })),
      upcoming: upcomingBookings,
    };
  }

  /**
   * Fast Global Search (Customer name, phone, token, appointment ID)
   */
  async globalSearch(tenantId: string, branchId: string, query: string) {
    if (!query || query.trim().length < 2) {
      return { customers: [], queueEntries: [], appointments: [] };
    }

    const q = query.trim();

    const [customers, queueEntries, appointments] = await Promise.all([
      this.prisma.customer.findMany({
        where: {
          tenantId,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q } },
          ],
        },
        take: 5,
      }),
      this.prisma.queueEntry.findMany({
        where: {
          tenantId,
          branchId,
          OR: [
            { tokenNumber: { contains: q, mode: 'insensitive' } },
            { customer: { phone: { contains: q } } },
            { customer: { name: { contains: q, mode: 'insensitive' } } },
          ],
        },
        include: { customer: true, staff: true },
        take: 5,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.appointment.findMany({
        where: {
          tenantId,
          branchId,
          OR: [
            { id: { contains: q } },
            { customer: { phone: { contains: q } } },
            { customer: { name: { contains: q, mode: 'insensitive' } } },
          ],
        },
        include: { customer: true, staff: true },
        take: 5,
        orderBy: { startTime: 'desc' },
      }),
    ]);

    return { customers, queueEntries, appointments };
  }

  /**
   * Start Service Quick Action
   */
  async startService(
    tenantId: string,
    queueEntryId: string,
    staffId?: string,
    actorId?: string,
    actorName?: string,
    actorRole?: string,
  ) {
    const entry = await this.prisma.queueEntry.findFirst({
      where: { id: queueEntryId, tenantId },
    });

    if (!entry) throw new NotFoundException('Queue entry not found');

    const assignedStaffId = staffId || entry.staffId;
    if (!assignedStaffId) {
      throw new BadRequestException('A stylist must be assigned to start service');
    }

    const now = new Date();

    const updated = await this.prisma.queueEntry.update({
      where: { id: queueEntryId },
      data: {
        status: QueueStatus.IN_SERVICE,
        staffId: assignedStaffId,
        serviceStartAt: now,
        history: {
          create: {
            fromStatus: entry.status,
            toStatus: QueueStatus.IN_SERVICE,
            actorId,
            actorName,
            actorRole,
            reason: 'Service started',
          },
        },
      },
    });

    // Mark staff as BUSY
    await this.prisma.staffProfile.update({
      where: { id: assignedStaffId },
      data: { operationalStatus: 'BUSY' },
    });

    if (entry.appointmentId) {
      await this.prisma.appointment.update({
        where: { id: entry.appointmentId },
        data: { status: AppointmentStatus.IN_SERVICE, serviceStartAt: now },
      });
    }

    await this.auditService.log({
      tenantId,
      branchId: entry.branchId,
      actorId,
      actorName,
      actorRole,
      action: 'SERVICE_STARTED',
      entityType: 'QueueEntry',
      entityId: queueEntryId,
      after: { staffId: assignedStaffId, serviceStartAt: now },
    });

    this.eventsGateway.broadcastTimelineUpdated(entry.branchId, {
      type: 'SERVICE_STARTED',
      queueEntryId,
      staffId: assignedStaffId,
    });

    return updated;
  }

  /**
   * Complete Service Quick Action
   */
  async completeService(
    tenantId: string,
    queueEntryId: string,
    actorId?: string,
    actorName?: string,
    actorRole?: string,
  ) {
    const entry = await this.prisma.queueEntry.findFirst({
      where: { id: queueEntryId, tenantId },
    });

    if (!entry) throw new NotFoundException('Queue entry not found');

    const now = new Date();

    const updated = await this.prisma.queueEntry.update({
      where: { id: queueEntryId },
      data: {
        status: QueueStatus.COMPLETED,
        completedAt: now,
        history: {
          create: {
            fromStatus: entry.status,
            toStatus: QueueStatus.COMPLETED,
            actorId,
            actorName,
            actorRole,
            reason: 'Service completed',
          },
        },
      },
    });

    // Free the stylist back to AVAILABLE if they have no other in-service entries
    if (entry.staffId) {
      const otherInService = await this.prisma.queueEntry.count({
        where: {
          staffId: entry.staffId,
          status: QueueStatus.IN_SERVICE,
          id: { not: queueEntryId },
        },
      });

      if (otherInService === 0) {
        await this.prisma.staffProfile.update({
          where: { id: entry.staffId },
          data: { operationalStatus: 'AVAILABLE' },
        });
      }
    }

    if (entry.appointmentId) {
      await this.prisma.appointment.update({
        where: { id: entry.appointmentId },
        data: { status: AppointmentStatus.COMPLETED, serviceCompleteAt: now },
      });
    }

    await this.auditService.log({
      tenantId,
      branchId: entry.branchId,
      actorId,
      actorName,
      actorRole,
      action: 'SERVICE_COMPLETED',
      entityType: 'QueueEntry',
      entityId: queueEntryId,
      after: { completedAt: now },
    });

    this.eventsGateway.broadcastTimelineUpdated(entry.branchId, {
      type: 'SERVICE_COMPLETED',
      queueEntryId,
    });

    return updated;
  }

  /**
   * Mark Appointment as No-Show
   */
  async markNoShow(
    tenantId: string,
    appointmentId: string,
    actorId?: string,
    actorName?: string,
    actorRole?: string,
  ) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, tenantId },
    });

    if (!appointment) throw new NotFoundException('Appointment not found');

    const updated = await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: AppointmentStatus.NO_SHOW,
        history: {
          create: {
            fromStatus: appointment.status,
            toStatus: AppointmentStatus.NO_SHOW,
            actorId,
            actorRole,
            reason: 'Customer did not arrive for scheduled slot',
          },
        },
      },
    });

    await this.auditService.log({
      tenantId,
      branchId: appointment.branchId,
      actorId,
      actorName,
      actorRole,
      action: 'APPOINTMENT_NO_SHOW',
      entityType: 'Appointment',
      entityId: appointmentId,
      before: { status: appointment.status },
      after: { status: AppointmentStatus.NO_SHOW },
    });

    this.eventsGateway.broadcastTimelineUpdated(appointment.branchId, {
      type: 'APPOINTMENT_NO_SHOW',
      appointmentId,
    });

    return updated;
  }
}
