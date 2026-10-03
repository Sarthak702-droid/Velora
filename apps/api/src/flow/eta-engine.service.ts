import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueueStatus } from '@prisma/client';

export interface CalculatedEta {
  remainingCurrentServiceMinutes: number;
  aheadDurationMinutes: number;
  bufferMinutes: number;
  totalEstimatedWaitMinutes: number;
  estimatedStartTime: Date;
}

@Injectable()
export class EtaEngineService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Deterministic ETA Engine (Section 25)
   * ETA = remaining duration of current service + durations of applicable customers ahead + configured buffers
   */
  async calculateQueueEta(
    tenantId: string,
    branchId: string,
    queueEntryId: string,
  ): Promise<CalculatedEta> {
    const entry = await this.prisma.queueEntry.findFirst({
      where: { id: queueEntryId, tenantId },
    });

    if (!entry) {
      return {
        remainingCurrentServiceMinutes: 0,
        aheadDurationMinutes: 0,
        bufferMinutes: 0,
        totalEstimatedWaitMinutes: 0,
        estimatedStartTime: new Date(),
      };
    }

    // 1. Find who is currently IN_SERVICE for the same stylist (or generally in the branch if stylist unassigned)
    const inServiceWhere: any = {
      branchId,
      status: QueueStatus.IN_SERVICE,
    };
    if (entry.staffId) {
      inServiceWhere.staffId = entry.staffId;
    }

    const currentInService = await this.prisma.queueEntry.findFirst({
      where: inServiceWhere,
      orderBy: { serviceStartAt: 'asc' },
    });

    let remainingCurrent = 0;
    if (currentInService && currentInService.serviceStartAt) {
      const elapsedMinutes = Math.floor(
        (Date.now() - new Date(currentInService.serviceStartAt).getTime()) / (1000 * 60),
      );
      remainingCurrent = Math.max(0, currentInService.totalDuration - elapsedMinutes);
    }

    // 2. Find customers ahead in queue
    const aheadWhere: any = {
      branchId,
      status: { in: [QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.CHECKED_IN] },
      position: { lt: entry.position },
    };
    if (entry.staffId) {
      aheadWhere.OR = [{ staffId: entry.staffId }, { staffId: null }];
    }

    const customersAhead = await this.prisma.queueEntry.findMany({
      where: aheadWhere,
    });

    const aheadDuration = customersAhead.reduce((sum, c) => sum + c.totalDuration, 0);
    const bufferMinutes = customersAhead.length * 5;
    const totalEstimatedWait = remainingCurrent + aheadDuration + bufferMinutes;

    const estimatedStartTime = new Date(Date.now() + totalEstimatedWait * 60 * 1000);

    return {
      remainingCurrentServiceMinutes: remainingCurrent,
      aheadDurationMinutes: aheadDuration,
      bufferMinutes,
      totalEstimatedWaitMinutes: totalEstimatedWait,
      estimatedStartTime,
    };
  }

  /**
   * Matches earliest available compatible professional for 'Any Available' (Section 26)
   */
  async matchOptimalStaff(
    tenantId: string,
    branchId: string,
    serviceIds: string[],
  ): Promise<string | null> {
    const candidateStaff = await this.prisma.staffProfile.findMany({
      where: {
        tenantId,
        active: true,
        operationalStatus: { in: ['AVAILABLE', 'BUSY'] },
        services: {
          some: { serviceId: { in: serviceIds } },
        },
      },
      include: {
        services: true,
        queueEntries: {
          where: {
            branchId,
            status: { in: [QueueStatus.WAITING, QueueStatus.IN_SERVICE, QueueStatus.CALLED] },
          },
        },
      },
    });

    // Filter staff who support all requested services
    const qualified = candidateStaff.filter((staff) => {
      const staffServiceIds = new Set(staff.services.map((ss) => ss.serviceId));
      return serviceIds.every((sId) => staffServiceIds.has(sId));
    });

    if (qualified.length === 0) return null;

    // Pick staff with lowest pending queue workload in minutes
    qualified.sort((a, b) => {
      const aWorkload = a.queueEntries.reduce((sum, e) => sum + e.totalDuration, 0);
      const bWorkload = b.queueEntries.reduce((sum, e) => sum + e.totalDuration, 0);
      return aWorkload - bWorkload;
    });

    return qualified[0].id;
  }
}
