import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async getCustomers(tenantId: string, query: { search?: string; limit?: number; offset?: number }) {
    const limit = Math.min(query.limit || 50, 100);
    const offset = query.offset || 0;
    const where: any = { tenantId };

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search } },
      ];
    }

    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { lastVisitAt: 'desc' },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return { customers, total, limit, offset };
  }

  async getCustomerById(tenantId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId },
      include: {
        appointments: {
          orderBy: { startTime: 'desc' },
          take: 10,
          include: {
            staff: true,
            services: { include: { service: true } },
          },
        },
        queueEntries: {
          orderBy: { joinedAt: 'desc' },
          take: 10,
          include: { staff: true },
        },
      },
    });

    if (!customer) throw new NotFoundException('Customer not found');

    return customer;
  }

  /**
   * Quick Rebook (Section 35)
   * Fetches most recent service IDs and preferred stylist for instant rebooking
   */
  async getQuickRebookData(tenantId: string, customerId: string) {
    const customer = await this.getCustomerById(tenantId, customerId);

    const lastAppointment = customer.appointments[0];
    if (!lastAppointment) {
      return {
        hasPreviousBooking: false,
        customer: { id: customer.id, name: customer.name, phone: customer.phone },
      };
    }

    const serviceIds = lastAppointment.services.map((s) => s.serviceId);
    const services = await this.prisma.service.findMany({
      where: { id: { in: serviceIds }, tenantId, active: true },
    });

    return {
      hasPreviousBooking: true,
      customer: { id: customer.id, name: customer.name, phone: customer.phone },
      preferredStaffId: lastAppointment.staffId || customer.preferredStaffId,
      services,
      lastVisitDate: lastAppointment.date,
    };
  }

  async updateCustomerNotes(tenantId: string, customerId: string, notes: string) {
    await this.getCustomerById(tenantId, customerId);
    return this.prisma.customer.update({
      where: { id: customerId },
      data: { notes },
    });
  }
}
