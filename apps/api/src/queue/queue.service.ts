import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EventsGateway } from "../events/events.gateway";
import { AuditService } from "../audit/audit.service";
import { QueueStatus, Prisma } from "@prisma/client";

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
    const cleanPhone = dto.customerPhone.trim().replace(/\s+/g, "");

    // 1. Fetch branch and queue configuration
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId, active: true },
      include: { queue: true },
    });

    if (!branch) {
      throw new NotFoundException("Branch not found or inactive");
    }

    let queue = branch.queue;
    if (!queue) {
      queue = await this.prisma.queue.create({
        data: {
          tenantId,
          branchId,
          prefix: "V",
          currentSequence: 0,
        },
      });
    }

    // 2. Fetch requested services
    const services = await this.prisma.service.findMany({
      where: { id: { in: serviceIds }, tenantId, active: true },
    });

    if (!serviceIds.length || services.length !== serviceIds.length) {
      throw new BadRequestException(
        "At least one valid service must be selected",
      );
    }

    if (dto.preferredStaffId && dto.preferredStaffId !== "any") {
      const staff = await this.prisma.staffProfile.findFirst({
        where: {
          id: dto.preferredStaffId,
          tenantId,
          active: true,
          schedules: { some: { branchId } },
        },
        include: { services: true },
      });
      if (
        !staff ||
        !serviceIds.every((id) =>
          staff.services.some((s) => s.serviceId === id),
        )
      )
        throw new BadRequestException(
          "Selected professional cannot provide all selected services at this branch",
        );
    }
    const professionals = await this.prisma.staffProfile.findMany({
      where: {
        tenantId,
        active: true,
        schedules: { some: { branchId, isWorkingDay: true } },
      },
      include: { services: true },
    });
    if (
      !professionals.some((staff) =>
        serviceIds.every((id) =>
          staff.services.some((s) => s.serviceId === id),
        ),
      )
    )
      throw new BadRequestException(
        "No professional provides this combination at this branch",
      );
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
      const tokenNumber = `${updatedQueue.prefix}${displayNumber.toString().padStart(3, "0")}`;

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
          status: {
            in: [
              QueueStatus.WAITING,
              QueueStatus.CALLED,
              QueueStatus.CHECKED_IN,
            ],
          },
        },
        orderBy: { position: "desc" },
      });

      const position = lastEntry ? lastEntry.position + 1 : 1;

      // Estimate initial wait time: sum of remaining/estimated duration of entries ahead
      const activeEntries = await tx.queueEntry.findMany({
        where: {
          branchId,
          status: {
            in: [
              QueueStatus.WAITING,
              QueueStatus.CALLED,
              QueueStatus.IN_SERVICE,
            ],
          },
        },
      });

      const estimatedWaitMinutes = activeEntries.reduce(
        (sum, e) =>
          sum +
          (e.status === QueueStatus.IN_SERVICE
            ? Math.ceil(e.totalDuration / 2)
            : e.totalDuration),
        0,
      );

      const staffId =
        dto.preferredStaffId && dto.preferredStaffId !== "any"
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
              actorName: actorName || "Walk-in / QR",
              actorRole: actorRole || "CUSTOMER",
              reason: "Customer joined queue",
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
      type: "QUEUE_JOINED",
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
      throw new NotFoundException(
        `Token '${tokenNumber}' not found in active queue`,
      );
    }

    // Count how many guests ahead
    const guestsAhead = await this.prisma.queueEntry.count({
      where: {
        branchId: entry.branchId,
        status: {
          in: [QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.CHECKED_IN],
        },
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
      estimatedWaitMinutes: Math.max(
        entry.estimatedWaitMinutes,
        guestsAhead * 15,
      ),
      status: entry.status,
      services: services.map((s) => s.name),
      joinedAt: entry.joinedAt,
      branchName: entry.branch.name,
    };
  }

  async getPrivateQueueStatus(tenantId: string, id: string) {
    const entry = await this.prisma.queueEntry.findFirst({
      where: { id, tenantId },
      include: { branch: true, staff: true },
    });
    if (!entry) throw new NotFoundException("Queue visit not found");
    const ahead = await this.prisma.queueEntry.findMany({
      where: {
        tenantId,
        branchId: entry.branchId,
        position: { lt: entry.position },
        status: { in: ["WAITING", "CALLED", "CHECKED_IN"] },
        ...(entry.staffId
          ? { OR: [{ staffId: entry.staffId }, { staffId: null }] }
          : {}),
      },
    });
    const active = await this.prisma.queueEntry.findMany({
      where: {
        tenantId,
        branchId: entry.branchId,
        status: "IN_SERVICE",
        ...(entry.staffId ? { staffId: entry.staffId } : {}),
      },
    });
    const pending = ["WAITING", "CALLED", "CHECKED_IN"].includes(entry.status);
    const minutes = pending
      ? ahead.reduce((sum, e) => sum + e.totalDuration + e.totalBuffer, 0) +
        active.reduce(
          (sum, e) =>
            sum +
            Math.max(
              0,
              e.totalDuration +
                e.totalBuffer -
                (e.serviceStartAt
                  ? (Date.now() - e.serviceStartAt.getTime()) / 60000
                  : 0),
            ),
          0,
        )
      : 0;
    const services = await this.prisma.service.findMany({
      where: { tenantId, id: { in: entry.serviceIds } },
      select: { name: true },
    });
    return {
      id: entry.id,
      tokenNumber: entry.tokenNumber,
      status: entry.status,
      position: pending ? ahead.length + 1 : 0,
      guestsAhead: pending ? ahead.length : 0,
      estimatedWaitMinutes: Math.ceil(minutes),
      services: services.map((s) => s.name),
      staffName: entry.staff?.name || "Any Available",
      branchName: entry.branch.name,
      joinedAt: entry.joinedAt,
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
      orderBy: { position: "asc" },
    });

    // Fetch service mappings for all entries
    const allServiceIds = Array.from(
      new Set(entries.flatMap((e) => e.serviceIds)),
    );
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
      throw new BadRequestException(
        "A valid reason is required to modify queue priority",
      );
    }

    const entry = await this.prisma.queueEntry.findFirst({
      where: { id: entryId, tenantId },
    });

    if (!entry) {
      throw new NotFoundException("Queue entry not found");
    }

    if (!["WAITING", "CALLED", "CHECKED_IN"].includes(entry.status))
      throw new BadRequestException("Only waiting visits can be reordered");
    const count = await this.prisma.queueEntry.count({
      where: {
        tenantId,
        branchId: entry.branchId,
        status: { in: ["WAITING", "CALLED", "CHECKED_IN"] },
      },
    });
    if (newPosition < 1 || newPosition > count)
      throw new BadRequestException("Position is outside the waiting queue");
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
            status: {
              in: [
                QueueStatus.WAITING,
                QueueStatus.CALLED,
                QueueStatus.CHECKED_IN,
              ],
            },
          },
          data: { position: { increment: 1 } },
        });
      } else {
        // Shift items up between oldPosition + 1 and newPosition
        await tx.queueEntry.updateMany({
          where: {
            branchId: entry.branchId,
            position: { gt: oldPosition, lte: newPosition },
            status: {
              in: [
                QueueStatus.WAITING,
                QueueStatus.CALLED,
                QueueStatus.CHECKED_IN,
              ],
            },
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
      action: "QUEUE_POSITION_CHANGED",
      entityType: "QueueEntry",
      entityId: entryId,
      before: { position: oldPosition },
      after: { position: newPosition },
      reason,
    });

    this.eventsGateway.broadcastQueueUpdated(entry.branchId, {
      type: "QUEUE_REORDERED",
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
    const allowed: Record<string, string[]> = {
      WAITING: [
        "CALLED",
        "CHECKED_IN",
        "IN_SERVICE",
        "CANCELLED",
        "LEFT",
        "SKIPPED",
      ],
      CALLED: ["CHECKED_IN", "IN_SERVICE", "CANCELLED", "LEFT", "SKIPPED"],
      CHECKED_IN: ["CALLED", "IN_SERVICE", "CANCELLED", "LEFT", "SKIPPED"],
      IN_SERVICE: ["COMPLETED"],
    };
    const updated = await this.prisma
      .$transaction(
        async (tx) => {
          const entry = await tx.queueEntry.findFirst({
            where: { id: entryId, tenantId },
          });
          if (!entry) throw new NotFoundException("Queue entry not found");
          if (!allowed[entry.status]?.includes(newStatus))
            throw new BadRequestException(
              `Cannot move ${entry.status} to ${newStatus}`,
            );
          const assignedStaffId = staffId || entry.staffId;
          if (newStatus === "IN_SERVICE") {
            if (!assignedStaffId)
              throw new BadRequestException(
                "Assign a professional before starting service",
              );
            const staff = await tx.staffProfile.findFirst({
              where: {
                id: assignedStaffId,
                tenantId,
                active: true,
                schedules: {
                  some: { branchId: entry.branchId, isWorkingDay: true },
                },
              },
              include: { services: true },
            });
            if (
              !staff ||
              !entry.serviceIds.every((id) =>
                staff.services.some((s) => s.serviceId === id),
              )
            )
              throw new BadRequestException(
                "Professional is incompatible with this service",
              );
            if (
              await tx.queueEntry.count({
                where: {
                  tenantId,
                  staffId: assignedStaffId,
                  status: "IN_SERVICE",
                },
              })
            )
              throw new ConflictException("Professional is already in service");
            await tx.staffProfile.update({
              where: { id: assignedStaffId },
              data: { operationalStatus: "BUSY" },
            });
          }
          const now = new Date();
          const data: Prisma.QueueEntryUpdateInput = {
            status: newStatus,
            ...(newStatus === "CALLED" ? { calledAt: now } : {}),
            ...(newStatus === "CHECKED_IN" ? { checkInAt: now } : {}),
            ...(newStatus === "IN_SERVICE"
              ? {
                  serviceStartAt: now,
                  staff: { connect: { id: assignedStaffId! } },
                }
              : {}),
            ...(newStatus === "COMPLETED" ? { completedAt: now } : {}),
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
          const result = await tx.queueEntry.update({
            where: { id: entryId },
            data,
          });
          if (newStatus === "COMPLETED" && entry.staffId) {
            const active = await tx.queueEntry.count({
              where: { staffId: entry.staffId, status: "IN_SERVICE" },
            });
            if (!active)
              await tx.staffProfile.update({
                where: { id: entry.staffId },
                data: { operationalStatus: "AVAILABLE" },
              });
          }
          if (entry.appointmentId) {
            if (newStatus === "IN_SERVICE")
              await tx.appointment.update({
                where: { id: entry.appointmentId },
                data: {
                  status: "IN_SERVICE",
                  staffId: assignedStaffId,
                  serviceStartAt: now,
                },
              });
            else if (newStatus === "COMPLETED")
              await tx.appointment.update({
                where: { id: entry.appointmentId },
                data: { status: "COMPLETED", serviceCompleteAt: now },
              });
            else if (["LEFT", "CANCELLED"].includes(newStatus))
              await tx.appointment.update({
                where: { id: entry.appointmentId },
                data: {
                  status: "CANCELLED",
                  cancellationReason: "Operational queue visit cancelled",
                },
              });
          }
          return result;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      )
      .catch((error) => {
        if (error.code === "P2034")
          throw new ConflictException(
            "This visit or professional changed. Refresh and try again.",
          );
        throw error;
      });
    await this.auditService.log({
      tenantId,
      branchId: updated.branchId,
      actorId,
      actorName,
      actorRole,
      action: "QUEUE_STATUS_CHANGED",
      entityType: "QueueEntry",
      entityId: entryId,
      after: { status: newStatus },
    });
    this.eventsGateway.broadcastQueueUpdated(updated.branchId, {
      type: "QUEUE_STATUS_UPDATED",
      tokenNumber: updated.tokenNumber,
      status: newStatus,
    });
    this.eventsGateway.broadcastTokenUpdated(updated.tokenNumber, {
      status: newStatus,
      tokenNumber: updated.tokenNumber,
    });
    this.eventsGateway.broadcastTimelineUpdated(updated.branchId, {
      type: "QUEUE_STATUS_UPDATED",
      entryId,
    });
    return updated;
  }
}
