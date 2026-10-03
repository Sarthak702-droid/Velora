import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  email?: string;
  phone?: string;
  role: string;
  tenantId?: string;
  branchId?: string;
  type?: 'staff' | 'customer';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'velora_super_secure_production_ready_jwt_secret_2026_x99',
    });
  }

  async validate(payload: JwtPayload) {
    if (payload.type === 'customer') {
      const customer = await this.prisma.customer.findUnique({
        where: { id: payload.sub },
      });
      if (!customer) {
        throw new UnauthorizedException('Customer session invalid');
      }
      return {
        id: customer.id,
        phone: customer.phone,
        name: customer.name,
        tenantId: customer.tenantId,
        role: 'CUSTOMER',
        isCustomer: true,
      };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        tenant: true,
        branch: true,
        staffProfile: true,
      },
    });

    if (!user || !user.active) {
      throw new UnauthorizedException('User account not found or deactivated');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      branchId: user.branchId,
      staffProfileId: user.staffProfile?.id,
      tenant: user.tenant,
      branch: user.branch,
    };
  }
}
