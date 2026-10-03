import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { AuditService } from '../audit/audit.service';
import { QueueStatus } from '@prisma/client';

export interface JoinQueueDto {
  branchId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  serviceIds: string[];
  preferredStaffId?: string; // or 'any'
  notes?: string;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
    private readonly auditService: AuditService,
  ) {}

  async joinQueue(
    tenantId: string,
    dto: JoinQueueDto,
    actorId?: string,
    actorName?: string,
    actorRole?: string,
  ) {
    const { branchId, serviceIds } = dto;
    const cleanPhone = dto.customerPhone.trim().replace(/\s+/g, '');

    // 1. Fetch branch and queue configuration
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId, active: true },
      include: { queue: true },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found or inactive');
    }

    let queue = branch.queue;
    if (!queue) {
      queue = await this.prisma.queue.create({
        data: {
          tenantId,
          branchId,
          prefix: 'V',
          currentSequence: 0,
        },
      });
    }

    // 2. Fetch requested services
    const services = await this.prisma.service.findMany({
      where: { id: { in: serviceIds }, tenantId, active: true },
    });

    if (services.length === 0) {
      throw new BadRequestException('At least one valid service must be selected');
    }

    const totalDuration = services.reduce((sum, s) => sum + s.duration, 0);
    const totalBuffer = Math.max(...services.map((s) => s.buffer), 5);

    // 3. Atomically advance token sequence and calculate queue position
    const entry = await this.prisma.$transaction(async (tx) => {
      const updatedQueue = await tx.queue.update({
        where: { id: queue.id },
        data: { currentSequence: { increment: 1 } },
      });

      const sequence = updatedQueue.currentSequence;
      const displayNumber = ((sequence - 1) % 999) + 1;
      const tokenNumber = `${updatedQueue.prefix}${displayNumber.toString().padStart(3, '0')}`;

      // Upsert customer
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
            totalVisits: 1,
            lastVisitAt: new Date(),
          },
        });
      } else {
        customer = await tx.customer.update({
          where: { id: customer.id },
          data: {
            name: dto.customerName || customer.name,
            totalVisits: { increment: 1 },
            lastVisitAt: new Date(),
          },
        });
      }

      // Calculate current maximum position in active queue
      const lastEntry = await tx.queueEntry.findFirst({
        where: {
          branchId,
          status: { in: [QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.CHECKED_IN] },
        },
        orderBy: { position: 'desc' },
      });

      const position = lastEntry ? lastEntry.position + 1 : 1;

      // Estimate initial wait time: sum of remaining/estimated duration of entries ahead
      const activeEntries = await tx.queueEntry.findMany({
        where: {
          branchId,
          status: { in: [QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.IN_SERVICE] },
        },
      });

      const estimatedWaitMinutes = activeEntries.reduce(
        (sum, e) => sum + (e.status === QueueStatus.IN_SERVICE ? Math.ceil(e.totalDuration / 2) : e.totalDuration),
        0,
      );

      const staffId =
        dto.preferredStaffId && dto.preferredStaffId !== 'any'
          ? dto.preferredStaffId
          : null;

      const newEntry = await tx.queueEntry.create({
        data: {
          tenantId,
          branchId,
          queueId: queue.id,
          customerId: customer.id,
          staffId,
          tokenNumber,
          displayNumber,
          serviceIds,
          totalDuration,
          totalBuffer,
          status: QueueStatus.WAITING,
          position,
          estimatedWaitMinutes,
          notes: dto.notes,
          history: {
            create: {
              fromPosition: null,
              toPosition: position,
              fromStatus: null,
              toStatus: QueueStatus.WAITING,
              actorId,
              actorName: actorName || 'Walk-in / QR',
              actorRole: actorRole || 'CUSTOMER',
              reason: 'Customer joined queue',
            },
          },
        },
        include: {
          customer: true,
          staff: true,
        },
      });

      return newEntry;
    });

    // Broadcast queue update to real-time clients
    this.eventsGateway.broadcastQueueUpdated(branchId, {
      type: 'QUEUE_JOINED',
      tokenNumber: entry.tokenNumber,
      position: entry.position,
    });

    return entry;
  }

  /**
   * Public Queue Status
   * Section 18 & 85.25: STRICT PRIVACY ENFORCEMENT
   * NEVER returns other customer names, phones, or notes!
   */
  async getPublicQueueStatus(tenantId: string, tokenNumber: string) {
    const entry = await this.prisma.queueEntry.findFirst({
      where: {
        tokenNumber,
        tenantId,
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            openingTime: true,
            closingTime: true,
          },
        },
      },
    });

    if (!entry) {
      throw new NotFoundException(`Token '${tokenNumber}' not found in active queue`);
    }

    // Count how many guests ahead
    const guestsAhead = await this.prisma.queueEntry.count({
      where: {
        branchId: entry.branchId,
        status: { in: [QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.CHECKED_IN] },
        position: { lt: entry.position },
      },
    });

    // Fetch service names without exposing internal IDs
    const services = await this.prisma.service.findMany({
      where: { id: { in: entry.serviceIds } },
      select: { name: true, duration: true },
    });

    return {
      tokenNumber: entry.tokenNumber,
      position: entry.position,
      guestsAhead,
      estimatedWaitMinutes: Math.max(entry.estimatedWaitMinutes, guestsAhead * 15),
      status: entry.status,
      services: services.map((s) => s.name),
      joinedAt: entry.joinedAt,
      branchName: entry.branch.name,
    };
  }

  /**
   * Internal Reception Desk Queue View
   */
  async getBranchQueue(tenantId: string, branchId: string) {
    const entries = await this.prisma.queueEntry.findMany({
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
        staff: true,
        appointment: true,
      },
      orderBy: { position: 'asc' },
    });

    // Fetch service mappings for all entries
    const allServiceIds = Array.from(new Set(entries.flatMap((e) => e.serviceIds)));
    const services = await this.prisma.service.findMany({
      where: { id: { in: allServiceIds } },
    });
    const serviceMap = new Map(services.map((s) => [s.id, s]));

    return entries.map((e) => ({
      ...e,
      services: e.serviceIds.map((id) => serviceMap.get(id)).filter(Boolean),
    }));
  }

  /**
   * Reorder Queue with Full Audit Logging (Section 20 & 85.24)
   */
  async reorderQueue(
    tenantId: string,
    entryId: string,
    newPosition: number,
    reason: string,
    actorId?: string,
    actorName?: string,
    actorRole?: string,
  ) {
    if (!reason || reason.trim().length < 3) {
      throw new BadRequestException('A valid reason is required to modify queue priority');
    }

    const entry = await this.prisma.queueEntry.findFirst({
      where: { id: entryId, tenantId },
    });

    if (!entry) {
      throw new NotFoundException('Queue entry not found');
    }

    const oldPosition = entry.position;
    if (oldPosition === newPosition) {
      return entry;
    }

    await this.prisma.$transaction(async (tx) => {
      if (newPosition < oldPosition) {
        // Shift items down between newPosition and oldPosition - 1
        await tx.queueEntry.updateMany({
          where: {
            branchId: entry.branchId,
            position: { gte: newPosition, lt: oldPosition },
            status: { in: [QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.CHECKED_IN] },
          },
          data: { position: { increment: 1 } },
        });
      } else {
        // Shift items up between oldPosition + 1 and newPosition
        await tx.queueEntry.updateMany({
          where: {
            branchId: entry.branchId,
            position: { gt: oldPosition, lte: newPosition },
            status: { in: [QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.CHECKED_IN] },
          },
          data: { position: { decrement: 1 } },
        });
      }

      // Update target entry
      await tx.queueEntry.update({
        where: { id: entryId },
        data: {
          position: newPosition,
          history: {
            create: {
              fromPosition: oldPosition,
              toPosition: newPosition,
              actorId,
              actorName,
              actorRole,
              reason,
            },
          },
        },
      });
    });

    // Record system audit log
    await this.auditService.log({
      tenantId,
      branchId: entry.branchId,
      actorId,
      actorName,
      actorRole,
      action: 'QUEUE_POSITION_CHANGED',
      entityType: 'QueueEntry',
      entityId: entryId,
      before: { position: oldPosition },
      after: { position: newPosition },
      reason,
    });

    this.eventsGateway.broadcastQueueUpdated(entry.branchId, {
      type: 'QUEUE_REORDERED',
      entryId,
      fromPosition: oldPosition,
      toPosition: newPosition,
    });

    return { success: true, oldPosition, newPosition };
  }

  async updateQueueStatus(
    tenantId: string,
    entryId: string,
    newStatus: QueueStatus,
    actorId?: string,
    actorName?: string,
    actorRole?: string,
    staffId?: string,
  ) {
    const entry = await this.prisma.queueEntry.findFirst({
      where: { id: entryId, tenantId },
    });

    if (!entry) {
      throw new NotFoundException('Queue entry not found');
    }

    const data: any = {
      status: newStatus,
      history: {
        create: {
          fromStatus: entry.status,
          toStatus: newStatus,
          actorId,
          actorName,
          actorRole,
          reason: `Status changed to ${newStatus}`,
        },
      },
    };

    if (newStatus === QueueStatus.CALLED) {
      data.calledAt = new Date();
    } else if (newStatus === QueueStatus.IN_SERVICE) {
      data.serviceStartAt = new Date();
      if (staffId) {
        data.staffId = staffId;
      }
    } else if (newStatus === QueueStatus.COMPLETED) {
      data.completedAt = new Date();
    }

    const updated = await this.prisma.queueEntry.update({
      where: { id: entryId },
      data,
    });

    // If associated with an appointment, update appointment status too
    if (entry.appointmentId) {
      let apptStatus: any = null;
      if (newStatus === QueueStatus.IN_SERVICE) apptStatus = 'IN_SERVICE';
      else if (newStatus === QueueStatus.COMPLETED) apptStatus = 'COMPLETED';

      if (apptStatus) {
        await this.prisma.appointment.update({
          where: { id: entry.appointmentId },
          data: { status: apptStatus },
        });
      }
    }

    this.eventsGateway.broadcastQueueUpdated(entry.branchId, {
      type: 'QUEUE_STATUS_UPDATED',
      tokenNumber: entry.tokenNumber,
      status: newStatus,
    });

    this.eventsGateway.broadcastTokenUpdated(entry.tokenNumber, {
      status: newStatus,
      tokenNumber: entry.tokenNumber,
    });

    return updated;
  }
}
