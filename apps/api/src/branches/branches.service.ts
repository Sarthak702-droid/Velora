import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  async getBranches(tenantId: string) {
    return this.prisma.branch.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getBranchById(tenantId: string, branchId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, tenantId },
    });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
    return branch;
  }

  async createBranch(tenantId: string, data: any) {
    const branch = await this.prisma.branch.create({
      data: {
        tenantId,
        ...data,
      },
    });

    // Automatically create a default Queue for the new branch
    await this.prisma.queue.create({
      data: {
        tenantId,
        branchId: branch.id,
        prefix: data.queuePrefix || 'V',
      },
    });

    return branch;
  }

  async updateBranch(tenantId: string, branchId: string, data: any) {
    await this.getBranchById(tenantId, branchId);
    return this.prisma.branch.update({
      where: { id: branchId },
      data,
    });
  }
}
