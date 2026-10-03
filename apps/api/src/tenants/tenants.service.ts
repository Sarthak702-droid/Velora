import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSalonBySlug(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
      include: {
        salonProfile: true,
        branches: {
          where: { active: true },
          select: {
            id: true,
            slug: true,
            name: true,
            address: true,
            city: true,
            state: true,
            phone: true,
            whatsapp: true,
            openingTime: true,
            closingTime: true,
            weeklyHolidays: true,
          },
        },
        serviceCategories: {
          where: { active: true },
          orderBy: { displayOrder: 'asc' },
          include: {
            services: {
              where: { active: true },
            },
          },
        },
        staffProfiles: {
          where: { active: true },
          select: {
            id: true,
            name: true,
            title: true,
            photoUrl: true,
            rating: true,
            reviewCount: true,
            operationalStatus: true,
            services: {
              select: { serviceId: true },
            },
          },
        },
      },
    });

    if (!tenant || tenant.status !== 'ACTIVE') {
      throw new NotFoundException(`Salon '${slug}' not found or inactive`);
    }

    return tenant;
  }

  async getProfile(tenantId: string) {
    const profile = await this.prisma.salonProfile.findUnique({
      where: { tenantId },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Salon profile not found');
    }

    return profile;
  }

  async updateProfile(tenantId: string, data: any) {
    return this.prisma.salonProfile.upsert({
      where: { tenantId },
      create: {
        tenantId,
        ...data,
      },
      update: {
        ...data,
      },
    });
  }
}
