import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EtaEngineService } from './eta-engine.service';
import { EventsGateway } from '../events/events.gateway';
import { AuditService } from '../audit/audit.service';
import { AppointmentStatus, QueueStatus } from '@prisma/client';

@Injectable()
export class FlowService {
  private readonly logger = new Logger(FlowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly etaEngine: EtaEngineService,
    private readonly eventsGateway: EventsGateway,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Appointment Check-in (Section 23)
   * Connects scheduled appointment to live operational queue
   */
  async checkInAppointment(
    tenantId: string,
    appointmentId: string,
    actorId?: string,
    actorName?: string,
    actorRole?: string,
  ) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, tenantId },
      include: {
        customer: true,
        services: true,
        branch: { include: { queue: true } },
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (appointment.status !== AppointmentStatus.CONFIRMED) {
      throw new BadRequestException(`Appointment is already in state ${appointment.status}`);
    }

    let queue = appointment.branch.queue;
    if (!queue) {
      queue = await this.prisma.queue.create({
        data: {
          tenantId,
          branchId: appointment.branchId,
          prefix: 'V',
          currentSequence: 0,
        },
      });
    }

    const checkInTime = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      // Advance token sequence
      const updatedQueue = await tx.queue.update({
        where: { id: queue.id },
        data: { currentSequence: { increment: 1 } },
      });

      const sequence = updatedQueue.currentSequence;
      const displayNumber = ((sequence - 1) % 999) + 1;
      const tokenNumber = `${updatedQueue.prefix}${displayNumber.toString().padStart(3, '0')}`;

      // Update appointment status to CHECKED_IN
      await tx.appointment.update({
        where: { id: appointmentId },
        data: {
          status: AppointmentStatus.CHECKED_IN,
          checkInAt: checkInTime,
          history: {
            create: {
              fromStatus: appointment.status,
              toStatus: AppointmentStatus.CHECKED_IN,
              actorId,
              actorRole,
              reason: 'Customer checked in at reception',
            },
          },
        },
      });

      // Scheduled appointments receive priority insertion at the front of WAITING queue (after any IN_SERVICE)
      const lowestWaiting = await tx.queueEntry.findFirst({
        where: {
          branchId: appointment.branchId,
          status: { in: [QueueStatus.WAITING, QueueStatus.CALLED] },
        },
        orderBy: { position: 'asc' },
      });

      const targetPosition = lowestWaiting ? Math.max(1, lowestWaiting.position) : 1;

      // Shift existing waiting entries to preserve appointment priority
      await tx.queueEntry.updateMany({
        where: {
          branchId: appointment.branchId,
          position: { gte: targetPosition },
          status: { in: [QueueStatus.WAITING, QueueStatus.CALLED] },
        },
        data: { position: { increment: 1 } },
      });

      const serviceIds = appointment.services.map((s) => s.serviceId);

      // Create linked queue entry
      const queueEntry = await tx.queueEntry.create({
        data: {
          tenantId,
          branchId: appointment.branchId,
          queueId: queue.id,
          customerId: appointment.customerId,
          staffId: appointment.staffId,
          appointmentId: appointment.id,
          tokenNumber,
          displayNumber,
          serviceIds,
          totalDuration: appointment.totalDuration,
          totalBuffer: appointment.totalBuffer,
          status: QueueStatus.CHECKED_IN,
          position: targetPosition,
          checkInAt: checkInTime,
          history: {
            create: {
              fromPosition: null,
              toPosition: targetPosition,
              fromStatus: null,
              toStatus: QueueStatus.CHECKED_IN,
              actorId,
              actorName,
              actorRole,
              reason: `Appointment customer checked in (${appointment.startTime.toISOString()})`,
            },
          },
        },
        include: {
          customer: true,
          staff: true,
          appointment: true,
        },
      });

      return queueEntry;
    });

    // Record audit log
    await this.auditService.log({
      tenantId,
      branchId: appointment.branchId,
      actorId,
      actorName,
      actorRole,
      action: 'APPOINTMENT_CHECKED_IN',
      entityType: 'Appointment',
      entityId: appointmentId,
      after: {
        tokenNumber: result.tokenNumber,
        position: result.position,
      },
      reason: 'Customer checked in at reception',
    });

    this.eventsGateway.broadcastTimelineUpdated(appointment.branchId, {
      type: 'APPOINTMENT_CHECKED_IN',
      appointmentId,
      tokenNumber: result.tokenNumber,
    });

    return result;
  }

  /**
   * Unified Salon Timeline (Section 22)
   * Connects Bookings + Walk-ins + Stylist Workload in one real-time view
   */
  async getUnifiedTimeline(tenantId: string, branchId: string, dateStr?: string) {
    const targetDate = dateStr
      ? new Date(`${dateStr}T00:00:00.000Z`)
      : new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z');

    // 1. Fetch staff
    const staffList = await this.prisma.staffProfile.findMany({
      where: { tenantId, active: true },
      include: {
        services: { include: { service: true } },
        schedules: { where: { branchId } },
        breaks: true,
      },
    });

    // 2. Fetch appointments for this day
    const appointments = await this.prisma.appointment.findMany({
      where: {
        tenantId,
        branchId,
        date: targetDate,
        status: { in: ['CONFIRMED', 'CHECKED_IN', 'IN_SERVICE', 'COMPLETED', 'WAITING'] },
      },
      include: {
        customer: true,
        services: { include: { service: true } },
      },
      orderBy: { startTime: 'asc' },
    });

    // 3. Fetch active live queue entries
    const liveQueueEntries = await this.prisma.queueEntry.findMany({
      where: {
        tenantId,
        branchId,
        status: {
          in: [
            QueueStatus.WAITING,
            QueueStatus.CALLED,
            QueueStatus.CHECKED_IN,
            QueueStatus.IN_SERVICE,
          ],
        },
      },
      include: {
        customer: true,
      },
      orderBy: { position: 'asc' },
    });

    // Fetch services map for queue entries
    const allServiceIds = Array.from(new Set(liveQueueEntries.flatMap((e) => e.serviceIds)));
    const services = await this.prisma.service.findMany({
      where: { id: { in: allServiceIds } },
    });
    const serviceMap = new Map(services.map((s) => [s.id, s]));

    // Construct unified timeline per staff
    const staffTimelines = staffList.map((staff) => {
      const staffAppointments = appointments.filter((a) => a.staffId === staff.id);
      const staffQueueEntries = liveQueueEntries
        .filter((q) => q.staffId === staff.id)
        .map((q) => ({
          ...q,
          services: q.serviceIds.map((id) => serviceMap.get(id)).filter(Boolean),
        }));

      return {
        staff: {
          id: staff.id,
          name: staff.name,
          title: staff.title,
          photoUrl: staff.photoUrl,
          operationalStatus: staff.operationalStatus,
        },
        appointments: staffAppointments,
        queueEntries: staffQueueEntries,
        currentCustomer: staffQueueEntries.find((q) => q.status === QueueStatus.IN_SERVICE) || null,
      };
    });

    // Unassigned walk-ins (waiting for "Any available")
    const unassignedQueue = liveQueueEntries
      .filter((q) => !q.staffId)
      .map((q) => ({
        ...q,
        services: q.serviceIds.map((id) => serviceMap.get(id)).filter(Boolean),
      }));

    return {
      date: targetDate.toISOString().slice(0, 10),
      branchId,
      staffTimelines,
      unassignedQueue,
    };
  }

  /**
   * Reassign Stylist with Audit Log
   */
  async reassignStylist(
    tenantId: string,
    queueEntryId: string,
    newStaffId: string,
    reason: string,
    actorId?: string,
    actorName?: string,
    actorRole?: string,
  ) {
    const entry = await this.prisma.queueEntry.findFirst({
      where: { id: queueEntryId, tenantId },
    });

    if (!entry) {
      throw new NotFoundException('Queue entry not found');
    }

    const oldStaffId = entry.staffId;

    const updated = await this.prisma.queueEntry.update({
      where: { id: queueEntryId },
      data: {
        staffId: newStaffId,
        history: {
          create: {
            fromStatus: entry.status,
            toStatus: entry.status,
            actorId,
            actorName,
            actorRole,
            reason: `Reassigned stylist: ${reason}`,
          },
        },
      },
    });

    await this.auditService.log({
      tenantId,
      branchId: entry.branchId,
      actorId,
      actorName,
      actorRole,
      action: 'STYLIST_REASSIGNED',
      entityType: 'QueueEntry',
      entityId: queueEntryId,
      before: { staffId: oldStaffId },
      after: { staffId: newStaffId },
      reason,
    });

    this.eventsGateway.broadcastTimelineUpdated(entry.branchId, {
      type: 'STYLIST_REASSIGNED',
      queueEntryId,
      newStaffId,
    });

    return updated;
  }
}
