import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { FEATURE_KEY } from '../decorators/metadata.decorator';
import { VeloraRequest } from '../middleware/context.middleware';

@Injectable()
export class FeatureEntitlementGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredFeature = this.reflector.getAllAndOverride<string>(FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredFeature) {
      return true;
    }

    const request = context.switchToHttp().getRequest<VeloraRequest>();
    const tenantId = request.tenantId || request.user?.tenantId;

    if (!tenantId) {
      throw new ForbiddenException('Tenant context required for feature entitlement check');
    }

    // 1. Check if tenant has an explicit override
    const override = await this.prisma.tenantFeatureOverride.findFirst({
      where: {
        tenantId,
        feature: { key: requiredFeature },
      },
    });

    if (override !== null) {
      if (!override.enabled) {
        throw new ForbiddenException(
          `Feature '${requiredFeature}' is disabled for this salon subscription`,
        );
      }
      return true;
    }

    // 2. Check tenant's active subscription and plan features
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        tenantId,
        status: { in: ['ACTIVE', 'TRIAL'] },
      },
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

    if (!subscription) {
      throw new ForbiddenException('No active subscription found for this salon');
    }

    const featureEnabled = subscription.plan.planFeatures.some(
      (pf) => pf.feature.key === requiredFeature && pf.enabled,
    );

    if (!featureEnabled) {
      throw new ForbiddenException(
        `Feature '${requiredFeature}' is not included in your ${subscription.plan.name} plan. Upgrade to unlock this module.`,
      );
    }

    return true;
  }
}
