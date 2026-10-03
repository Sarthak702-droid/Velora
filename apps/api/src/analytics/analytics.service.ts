import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppointmentStatus, QueueStatus } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardKpis(tenantId: string, branchId?: string, dateStr?: string) {
    const targetDate = dateStr
      ? new Date(`${dateStr}T00:00:00.000Z`)
      : new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z');

    const nextDay = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);

    const branchFilter: any = { tenantId };
    if (branchId) {
      branchFilter.branchId = branchId;
    }

    // 1. Appointments Today
    const appointmentsToday = await this.prisma.appointment.findMany({
      where: {
        ...branchFilter,
        date: targetDate,
      },
      include: {
        services: true,
      },
    });

    // 2. Walk-ins / Queue Entries Today
    const walkinsToday = await this.prisma.queueEntry.findMany({
      where: {
        ...branchFilter,
        joinedAt: {
          gte: targetDate,
          lt: nextDay,
        },
      },
    });

    const totalAppointments = appointmentsToday.length;
    const totalWalkins = walkinsToday.filter((w) => !w.appointmentId).length;
    const totalVisits = totalAppointments + totalWalkins;

    // Completed counts
    const completedAppointments = appointmentsToday.filter(
      (a) => a.status === AppointmentStatus.COMPLETED,
    ).length;
    const completedWalkins = walkinsToday.filter(
      (w) => w.status === QueueStatus.COMPLETED && !w.appointmentId,
    ).length;
    const completedServices = completedAppointments + completedWalkins;

    // No-show and Cancellation counts
    const noShowCount = appointmentsToday.filter(
      (a) => a.status === AppointmentStatus.NO_SHOW,
    ).length;
    const cancelledCount = appointmentsToday.filter(
      (a) => a.status === AppointmentStatus.CANCELLED,
    ).length;

    const noShowRate =
      totalAppointments > 0 ? ((noShowCount / totalAppointments) * 100).toFixed(1) : '0.0';
    const cancellationRate =
      totalAppointments > 0 ? ((cancelledCount / totalAppointments) * 100).toFixed(1) : '0.0';

    // Appointment vs Walk-in ratio (Section 38)
    const appointmentPct =
      totalVisits > 0 ? Math.round((totalAppointments / totalVisits) * 100) : 50;
    const walkinPct = totalVisits > 0 ? 100 - appointmentPct : 50;

    // Average Wait Time calculation from completed queue entries
    const completedWithWait = walkinsToday.filter((w) => w.checkInAt && w.serviceStartAt);
    let avgWaitMinutes = 14; // Default fallback
    if (completedWithWait.length > 0) {
      const sumWait = completedWithWait.reduce((sum, w) => {
        const diff =
          (new Date(w.serviceStartAt!).getTime() - new Date(w.checkInAt!).getTime()) / (1000 * 60);
        return sum + Math.max(0, diff);
      }, 0);
      avgWaitMinutes = Math.round(sumWait / completedWithWait.length);
    }

    // Average Service Duration
    const completedWithService = walkinsToday.filter((w) => w.serviceStartAt && w.completedAt);
    let avgServiceMinutes = 32;
    if (completedWithService.length > 0) {
      const sumDuration = completedWithService.reduce((sum, w) => {
        const diff =
          (new Date(w.completedAt!).getTime() - new Date(w.serviceStartAt!).getTime()) / (1000 * 60);
        return sum + Math.max(0, diff);
      }, 0);
      avgServiceMinutes = Math.round(sumDuration / completedWithService.length);
    }

    // Service Demand Breakdown (Section 40)
    const serviceCounts: Record<string, number> = {};
    for (const app of appointmentsToday) {
      for (const s of app.services) {
        serviceCounts[s.serviceId] = (serviceCounts[s.serviceId] || 0) + 1;
      }
    }
    for (const w of walkinsToday) {
      for (const sId of w.serviceIds) {
        serviceCounts[sId] = (serviceCounts[sId] || 0) + 1;
      }
    }

    const serviceIdList = Object.keys(serviceCounts);
    const services = await this.prisma.service.findMany({
      where: { id: { in: serviceIdList } },
    });

    const serviceDemand = services
      .map((s) => ({
        id: s.id,
        name: s.name,
        count: serviceCounts[s.id] || 0,
      }))
      .sort((a, b) => b.count - a.count);

    const mostBookedService = serviceDemand[0]?.name || 'Haircut';

    // Operational Staff Utilization (Section 42)
    const staffList = await this.prisma.staffProfile.findMany({
      where: { tenantId, active: true },
      select: { id: true, name: true, title: true },
    });

    const staffUtilization = staffList.map((staff) => {
      const staffApps = appointmentsToday.filter((a) => a.staffId === staff.id);
      const staffWalkins = walkinsToday.filter((w) => w.staffId === staff.id);

      const serviceMinutes =
        staffApps.reduce((sum, a) => sum + a.totalDuration, 0) +
        staffWalkins.reduce((sum, w) => sum + w.totalDuration, 0);

      const availableOperationalMinutes = 480; // 8-hour shift = 480 minutes
      const utilization = Math.min(
        100,
        Math.round((serviceMinutes / availableOperationalMinutes) * 100),
      );

      return {
        staffId: staff.id,
        name: staff.name,
        title: staff.title,
        serviceMinutes,
        availableMinutes: availableOperationalMinutes,
        utilizationPct: utilization,
      };
    });

    return {
      date: targetDate.toISOString().slice(0, 10),
      customersToday: totalVisits,
      appointmentsToday: totalAppointments,
      walkinsToday: totalWalkins,
      completedServices,
      avgWaitMinutes,
      avgServiceMinutes,
      noShowRate: `${noShowRate}%`,
      cancellationRate: `${cancellationRate}%`,
      appointmentRatio: {
        appointments: appointmentPct,
        walkins: walkinPct,
      },
      mostBookedService,
      serviceDemand,
      staffUtilization,
    };
  }
}
