import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityService } from '../security/security.service';
import { OtpService } from '../security/otp.service';
import { LoginDto, CustomerOtpRequestDto, CustomerOtpVerifyDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly securityService: SecurityService,
    private readonly otpService: OtpService,
  ) {}

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
      include: {
        tenant: {
          include: {
            salonProfile: true,
          },
        },
        branch: true,
        staffProfile: true,
      },
    });

    if (!user || !user.active) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isMatch = await this.securityService.comparePassword(
      dto.password,
      user.passwordHash,
    );

    if (!isMatch) {
      // Audit log failed login
      await this.prisma.auditLog.create({
        data: {
          tenantId: user.tenantId,
          branchId: user.branchId,
          actorId: user.id,
          actorName: user.name,
          actorRole: user.role,
          action: 'AUTH_LOGIN_FAILED',
          entityType: 'User',
          entityId: user.id,
          ipAddress,
          userAgent,
          reason: 'Incorrect password entered',
        },
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      branchId: user.branchId,
      type: 'staff',
    };

    const token = this.jwtService.sign(payload);

    // Audit log successful login
    await this.prisma.auditLog.create({
      data: {
        tenantId: user.tenantId,
        branchId: user.branchId,
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        action: 'AUTH_LOGIN_SUCCESS',
        entityType: 'User',
        entityId: user.id,
        ipAddress,
        userAgent,
      },
    });

    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        branchId: user.branchId,
        staffProfileId: user.staffProfile?.id,
        salon: user.tenant
          ? {
              id: user.tenant.id,
              name: user.tenant.name,
              slug: user.tenant.slug,
              profile: user.tenant.salonProfile,
            }
          : null,
        branch: user.branch
          ? {
              id: user.branch.id,
              name: user.branch.name,
              slug: user.branch.slug,
            }
          : null,
      },
    };
  }

  async requestCustomerOtp(dto: CustomerOtpRequestDto, ipAddress?: string) {
    return this.otpService.requestOtp(dto.phone, ipAddress);
  }

  async verifyCustomerOtp(dto: CustomerOtpVerifyDto, tenantId?: string) {
    const verified = await this.otpService.verifyOtp(dto.phone, dto.otp);
    if (!verified) {
      throw new UnauthorizedException('Verification failed');
    }

    const cleanPhone = dto.phone.trim().replace(/\s+/g, '');
    let resolvedTenantId = tenantId;

    if (!resolvedTenantId) {
      // Find tenant from default or first active tenant
      const defaultTenant = await this.prisma.tenant.findFirst({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
      });
      resolvedTenantId = defaultTenant?.id;
    }

    if (!resolvedTenantId) {
      throw new BadRequestException('No active salon tenant available');
    }

    // Upsert customer record
    let customer = await this.prisma.customer.findUnique({
      where: {
        tenantId_phone: {
          tenantId: resolvedTenantId,
          phone: cleanPhone,
        },
      },
    });

    if (!customer) {
      customer = await this.prisma.customer.create({
        data: {
          tenantId: resolvedTenantId,
          phone: cleanPhone,
          name: dto.name || 'Velora Guest',
        },
      });
    } else if (dto.name && customer.name === 'Velora Guest') {
      customer = await this.prisma.customer.update({
        where: { id: customer.id },
        data: { name: dto.name },
      });
    }

    const token = this.jwtService.sign({
      sub: customer.id,
      phone: customer.phone,
      role: 'CUSTOMER',
      tenantId: resolvedTenantId,
      type: 'customer',
    });

    return {
      accessToken: token,
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        tenantId: customer.tenantId,
        totalVisits: customer.totalVisits,
      },
    };
  }
}
