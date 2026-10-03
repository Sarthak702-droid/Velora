import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OperationalStatus } from '@prisma/client';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async getStaff(tenantId: string, serviceId?: string) {
    const where: any = { tenantId, active: true };
    if (serviceId) {
      where.services = {
        some: { serviceId },
      };
    }

    return this.prisma.staffProfile.findMany({
      where,
      include: {
        services: {
          include: {
            service: true,
          },
        },
        schedules: true,
        breaks: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async getStaffById(tenantId: string, staffId: string) {
    const staff = await this.prisma.staffProfile.findFirst({
      where: { id: staffId, tenantId },
      include: {
        services: {
          include: {
            service: true,
          },
        },
        schedules: true,
        breaks: true,
      },
    });

    if (!staff) {
      throw new NotFoundException('Stylist not found');
    }

    return staff;
  }

  async updateOperationalStatus(
    tenantId: string,
    staffId: string,
    status: OperationalStatus,
    branchId?: string,
  ) {
    await this.getStaffById(tenantId, staffId);
    const updated = await this.prisma.staffProfile.update({
      where: { id: staffId },
      data: { operationalStatus: status },
    });

    if (branchId) {
      this.eventsGateway.broadcastStaffStatusChanged(branchId, {
        staffId,
        status,
      });
    }

    return updated;
  }
}
