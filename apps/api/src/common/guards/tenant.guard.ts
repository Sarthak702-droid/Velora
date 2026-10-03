import { PrismaService } from "../../prisma/prisma.service";
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { VeloraRequest } from "../middleware/context.middleware";

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<VeloraRequest>();
    const user = request.user;
    const contextFree =
      request.originalUrl.includes("/tenants/public/") ||
      request.originalUrl.split("?")[0].endsWith("/auth/login") ||
      request.originalUrl.includes("/payments/webhook/");
    if (!user && !request.tenantId && !contextFree)
      throw new BadRequestException("Tenant context is required");

    // If request is from an authenticated internal staff user
    if (user && user.role !== UserRole.PLATFORM_ADMIN) {
      if (!user.tenantId) {
        throw new ForbiddenException("User has no associated tenant");
      }

      // Check if request specifies a tenant that doesn't match
      const explicitTenant =
        request.tenantId ||
        request.params?.tenantId ||
        request.body?.tenantId ||
        (request.query?.tenantId as string);

      if (explicitTenant && explicitTenant !== user.tenantId) {
        throw new ForbiddenException(
          "Tenant isolation violation: you do not have permission to access another salon tenant",
        );
      }

      // Always bind the authenticated user's tenantId into request context
      request.tenantId = user.tenantId;

      // If branch manager or professional, verify branch isolation if branchId provided
      if (
        (user.role === UserRole.BRANCH_MANAGER ||
          user.role === UserRole.PROFESSIONAL ||
          user.role === UserRole.RECEPTIONIST) &&
        user.branchId
      ) {
        const explicitBranch =
          request.branchId ||
          request.params?.branchId ||
          request.body?.branchId ||
          (request.query?.branchId as string);

        if (explicitBranch && explicitBranch !== user.branchId) {
          throw new ForbiddenException(
            "Branch isolation violation: you cannot access data outside your assigned branch",
          );
        }
        // Resolve branch for identifier-only mutations; a missing branch header must not bypass isolation.
        const appointmentId =
          request.params?.appointmentId ||
          (request.originalUrl.includes("/bookings/") ||
          request.originalUrl.includes("/desk/no-show/")
            ? request.params?.id
            : undefined);
        const queueId =
          request.params?.queueEntryId ||
          request.body?.queueEntryId ||
          (request.originalUrl.includes("/queue/") ||
          request.originalUrl.includes("/desk/start-service/") ||
          request.originalUrl.includes("/desk/complete-service/")
            ? request.params?.id
            : undefined);
        const resource = appointmentId
          ? await this.prisma.appointment.findFirst({
              where: { id: String(appointmentId), tenantId: user.tenantId },
              select: { branchId: true, staffId: true },
            })
          : queueId
            ? await this.prisma.queueEntry.findFirst({
                where: { id: String(queueId), tenantId: user.tenantId },
                select: { branchId: true, staffId: true },
              })
            : null;
        if (resource && resource.branchId !== user.branchId)
          throw new ForbiddenException("Branch access denied");
        if (
          resource &&
          user.role === UserRole.PROFESSIONAL &&
          resource.staffId &&
          resource.staffId !== user.staffProfileId
        )
          throw new ForbiddenException(
            "This visit is assigned to another professional",
          );
        request.branchId = user.branchId;
      }
    }

    return true;
  }
}
