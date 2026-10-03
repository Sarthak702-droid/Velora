import { zonedTime, localMinutes } from "./zoned-time";
import { BadRequestException } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface SlotCalculationInput {
  tenantId: string;
  branchId: string;
  serviceIds: string[];
  dateStr: string; // YYYY-MM-DD
  excludeAppointmentId?: string;
  staffId?: string; // Optional: specific stylist or 'any'
}

export interface AvailableSlot {
  time: string; // "10:00"
  timestamp: string; // ISO string
  staffId: string;
  staffName: string;
}

@Injectable()
export class DynamicSlotEngine {
  constructor(private readonly prisma: PrismaService) {}

  async calculateAvailableSlots(
    input: SlotCalculationInput,
  ): Promise<AvailableSlot[]> {
    const { tenantId, branchId, serviceIds, dateStr, staffId } = input;

    if (
      !tenantId ||
      !branchId ||
      !/^\d{4}-\d{2}-\d{2}$/.test(dateStr || "") ||
      !serviceIds.length
    )
      throw new BadRequestException(
        "Tenant, branch, services and a valid date are required",
      );
    if (!Number.isFinite(Date.parse(`${dateStr}T00:00:00Z`)))
      throw new BadRequestException("Invalid date");
    // 1. Fetch branch operating hours
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId },
    });
    if (!branch || !branch.active) {
      return [];
    }

    const targetDate = new Date(`${dateStr}T00:00:00.000Z`);
    const dayOfWeek = targetDate.getUTCDay(); // 0 = Sunday, 1 = Monday ... 6 = Saturday

    const dayNameMap = [
      "SUNDAY",
      "MONDAY",
      "TUESDAY",
      "WEDNESDAY",
      "THURSDAY",
      "FRIDAY",
      "SATURDAY",
    ];
    if (branch.weeklyHolidays.includes(dayNameMap[dayOfWeek])) {
      return []; // Salon is closed on this holiday
    }

    // 2. Fetch requested services to determine total required duration + buffer
    const services = await this.prisma.service.findMany({
      where: {
        id: { in: serviceIds },
        tenantId,
        active: true,
      },
    });

    if (services.length !== serviceIds.length) {
      return [];
    }

    const totalDuration = services.reduce((sum, s) => sum + s.duration, 0);
    const totalBuffer = Math.max(...services.map((s) => s.buffer), 5);
    const totalBlockMinutes = totalDuration + totalBuffer;

    // 3. Identify compatible staff who provide ALL requested services
    let candidateStaffQuery: any = {
      tenantId,
      active: true,
      schedules: { some: { branchId, dayOfWeek, isWorkingDay: true } },
      services: {
        some: { serviceId: { in: serviceIds } },
      },
    };

    if (staffId && staffId !== "any") {
      candidateStaffQuery.id = staffId;
    }

    const candidateStaff = await this.prisma.staffProfile.findMany({
      where: candidateStaffQuery,
      include: {
        services: true,
        schedules: {
          where: { branchId, dayOfWeek },
        },
        breaks: true,
      },
    });

    // Filter staff who can perform all requested services
    const qualifiedStaff = candidateStaff.filter((staff) => {
      const staffServiceIds = new Set(staff.services.map((ss) => ss.serviceId));
      return serviceIds.every((sId) => staffServiceIds.has(sId));
    });

    if (qualifiedStaff.length === 0) {
      return [];
    }

    // 4. Fetch existing confirmed/checked_in/in_service appointments on that day for these stylists
    const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
    const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);

    const existingAppointments = await this.prisma.appointment.findMany({
      where: {
        tenantId,
        branchId,
        date: startOfDay,
        status: { in: ["CONFIRMED", "CHECKED_IN", "IN_SERVICE", "WAITING"] },
        staffId: { in: qualifiedStaff.map((s) => s.id) },
        ...(input.excludeAppointmentId
          ? { id: { not: input.excludeAppointmentId } }
          : {}),
      },
      select: {
        id: true,
        staffId: true,
        startTime: true,
        endTime: true,
      },
    });

    const slots: AvailableSlot[] = [];
    const slotStepMinutes = 15; // 15-minute grid evaluation for dynamic slot engine

    const [openH, openM] = branch.openingTime.split(":").map(Number);
    const [closeH, closeM] = branch.closingTime.split(":").map(Number);
    const openTotalMinutes = openH * 60 + openM;
    const closeTotalMinutes = closeH * 60 + closeM;

    for (const staff of qualifiedStaff) {
      // Check stylist schedule on this day
      const schedule = staff.schedules[0];
      let staffStartMinutes = openTotalMinutes;
      let staffEndMinutes = closeTotalMinutes;

      if (!schedule) continue;
      if (schedule) {
        if (!schedule.isWorkingDay) continue; // Not working today
        const [shH, shM] = schedule.startTime.split(":").map(Number);
        const [ehH, ehM] = schedule.endTime.split(":").map(Number);
        staffStartMinutes = Math.max(openTotalMinutes, shH * 60 + shM);
        staffEndMinutes = Math.min(closeTotalMinutes, ehH * 60 + ehM);
      }

      // Check breaks
      const staffBreaks = staff.breaks
        .filter((b) => b.dayOfWeek === null || b.dayOfWeek === dayOfWeek)
        .map((b) => {
          const [bsH, bsM] = b.startTime.split(":").map(Number);
          const [beH, beM] = b.endTime.split(":").map(Number);
          return { start: bsH * 60 + bsM, end: beH * 60 + beM };
        });

      // Existing appointments for this staff converted to minutes of the day
      const staffAppointments = existingAppointments
        .filter((a) => a.staffId === staff.id)
        .map((a) => {
          const s = new Date(a.startTime);
          const e = new Date(a.endTime);
          return {
            start: localMinutes(s, branch.timezone),
            end: localMinutes(e, branch.timezone),
          };
        });

      // Iterate in slot intervals
      for (
        let timeMinutes = staffStartMinutes;
        timeMinutes + totalBlockMinutes <= staffEndMinutes;
        timeMinutes += slotStepMinutes
      ) {
        const slotEndMinutes = timeMinutes + totalBlockMinutes;

        // Check break collisions
        const collidesWithBreak = staffBreaks.some(
          (b) =>
            Math.max(timeMinutes, b.start) < Math.min(slotEndMinutes, b.end),
        );
        if (collidesWithBreak) continue;

        // Check appointment collisions
        const collidesWithAppointment = staffAppointments.some(
          (app) =>
            Math.max(timeMinutes, app.start) <
            Math.min(slotEndMinutes, app.end),
        );
        if (collidesWithAppointment) continue;

        const hours = Math.floor(timeMinutes / 60);
        const mins = timeMinutes % 60;
        const timeStr = `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
        const instant = zonedTime(dateStr, timeStr, branch.timezone);
        if (instant.getTime() <= Date.now()) continue;
        const slotTimestamp = instant.toISOString();

        slots.push({
          time: timeStr,
          timestamp: slotTimestamp,
          staffId: staff.id,
          staffName: staff.name,
        });
      }
    }

    // Sort slots chronologically and deduplicate times if customer selected 'any'
    slots.sort((a, b) => a.time.localeCompare(b.time));

    if (!staffId || staffId === "any") {
      const seenTimes = new Set<string>();
      const dedupedSlots: AvailableSlot[] = [];
      for (const s of slots) {
        if (!seenTimes.has(s.time)) {
          seenTimes.add(s.time);
          dedupedSlots.push(s);
        }
      }
      return dedupedSlots;
    }

    return slots;
  }
}
