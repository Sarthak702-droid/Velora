import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPlans() {
    return this.prisma.plan.findMany({
      include: {
        planFeatures: {
          include: {
            feature: true,
          },
        },
      },
      orderBy: { monthlyPrice: 'asc' },
    });
  }

  async getCurrentSubscription(tenantId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { tenantId },
      include: {
        plan: {
          include: {
            planFeatures: {
              include: {
                feature: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const overrides = await this.prisma.tenantFeatureOverride.findMany({
      where: { tenantId },
      include: { feature: true },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found for this tenant');
    }

    // Build effective feature matrix
    const effectiveFeatures: Record<string, boolean> = {};
    for (const pf of subscription.plan.planFeatures) {
      effectiveFeatures[pf.feature.key] = pf.enabled;
    }
    for (const ov of overrides) {
      effectiveFeatures[ov.feature.key] = ov.enabled;
    }

    return {
      subscription,
      overrides,
      effectiveFeatures,
    };
  }

  async checkFeature(tenantId: string, featureKey: string): Promise<boolean> {
    const { effectiveFeatures } = await this.getCurrentSubscription(tenantId);
    return !!effectiveFeatures[featureKey];
  }
}
