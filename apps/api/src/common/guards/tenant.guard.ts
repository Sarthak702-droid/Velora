import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { VeloraRequest } from '../middleware/context.middleware';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<VeloraRequest>();
    const user = request.user;

    // If request is from an authenticated internal staff user
    if (user && user.role !== UserRole.PLATFORM_ADMIN) {
      if (!user.tenantId) {
        throw new ForbiddenException('User has no associated tenant');
      }

      // Check if request specifies a tenant that doesn't match
      const explicitTenant =
        request.tenantId ||
        request.params?.tenantId ||
        request.body?.tenantId ||
        (request.query?.tenantId as string);

      if (explicitTenant && explicitTenant !== user.tenantId) {
        throw new ForbiddenException(
          'Tenant isolation violation: you do not have permission to access another salon tenant',
        );
      }

      // Always bind the authenticated user's tenantId into request context
      request.tenantId = user.tenantId;

      // If branch manager or professional, verify branch isolation if branchId provided
      if (
        (user.role === UserRole.BRANCH_MANAGER || user.role === UserRole.PROFESSIONAL) &&
        user.branchId
      ) {
        const explicitBranch =
          request.branchId ||
          request.params?.branchId ||
          request.body?.branchId ||
          (request.query?.branchId as string);

        if (explicitBranch && explicitBranch !== user.branchId) {
          throw new ForbiddenException(
            'Branch isolation violation: you cannot access data outside your assigned branch',
          );
        }
        request.branchId = user.branchId;
      }
    }

    return true;
  }
}
