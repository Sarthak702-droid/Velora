import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async getCategories(tenantId: string) {
    return this.prisma.serviceCategory.findMany({
      where: { tenantId, active: true },
      orderBy: { displayOrder: 'asc' },
      include: {
        services: {
          where: { active: true },
          orderBy: { name: 'asc' },
        },
      },
    });
  }

  async getServices(tenantId: string, categoryId?: string) {
    const where: any = { tenantId, active: true };
    if (categoryId) {
      where.categoryId = categoryId;
    }
    return this.prisma.service.findMany({
      where,
      include: {
        category: true,
        staff: {
          include: {
            staff: {
              select: {
                id: true,
                name: true,
                photoUrl: true,
                title: true,
                operationalStatus: true,
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getServiceById(tenantId: string, serviceId: string) {
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, tenantId },
      include: { category: true },
    });
    if (!service) {
      throw new NotFoundException('Service not found');
    }
    return service;
  }

  async createService(tenantId: string, data: any) {
    return this.prisma.service.create({
      data: {
        tenantId,
        ...data,
      },
    });
  }

  async updateService(tenantId: string, serviceId: string, data: any) {
    await this.getServiceById(tenantId, serviceId);
    return this.prisma.service.update({
      where: { id: serviceId },
      data,
    });
  }
}
