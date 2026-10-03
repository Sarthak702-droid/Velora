import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export const FEATURE_KEY = 'requiredFeature';
export const RequireFeature = (featureKey: string) => SetMetadata(FEATURE_KEY, featureKey);
