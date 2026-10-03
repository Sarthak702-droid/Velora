import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityService } from './security.service';
import * as crypto from 'crypto';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly OTP_EXPIRY_MINUTES = 5;
  private readonly COOLDOWN_SECONDS = 60;
  private readonly MAX_ATTEMPTS = 5;

  constructor(
    private readonly prisma: PrismaService,
    private readonly security: SecurityService,
  ) {}

  async requestOtp(phone: string, ipAddress?: string): Promise<{ success: boolean; message: string; cooldownSeconds: number }> {
    const cleanPhone = phone.trim().replace(/\s+/g, '');
    const now = new Date();

    // Check resend cooldown
    const recentOtp = await this.prisma.securityOtp.findFirst({
      where: {
        phone: cleanPhone,
        createdAt: {
          gte: new Date(now.getTime() - this.COOLDOWN_SECONDS * 1000),
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recentOtp) {
      const waitTime = Math.ceil(
        (recentOtp.createdAt.getTime() + this.COOLDOWN_SECONDS * 1000 - now.getTime()) / 1000,
      );
      throw new BadRequestException(
        `Please wait ${waitTime} seconds before requesting a new verification code.`,
      );
    }

    // Generate secure 6-digit numeric OTP
    const otpValue = crypto.randomInt(100000, 999999).toString();
    const tokenHash = this.security.hashOtp(cleanPhone, otpValue);
    const expiresAt = new Date(now.getTime() + this.OTP_EXPIRY_MINUTES * 60 * 1000);

    // Invalidate previous unconsumed OTPs for this phone
    await this.prisma.securityOtp.updateMany({
      where: { phone: cleanPhone, consumed: false },
      data: { consumed: true },
    });

    // Store hashed OTP
    await this.prisma.securityOtp.create({
      data: {
        phone: cleanPhone,
        tokenHash,
        expiresAt,
        ipAddress,
        attempts: 0,
        consumed: false,
      },
    });

    // In production, send via WhatsApp/SMS provider. In development/testing, log only delivery status (NOT the plain OTP)
    this.logger.log(`[OTP DISPATCHED] Verification code generated for ${cleanPhone.slice(-4)}`);

    return {
      success: true,
      message: 'Verification code sent successfully',
      cooldownSeconds: this.COOLDOWN_SECONDS,
    };
  }

  async verifyOtp(phone: string, candidateOtp: string): Promise<boolean> {
    const cleanPhone = phone.trim().replace(/\s+/g, '');
    const now = new Date();

    const record = await this.prisma.securityOtp.findFirst({
      where: {
        phone: cleanPhone,
        consumed: false,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      throw new BadRequestException('Verification code has expired or was not requested.');
    }

    if (record.attempts >= this.MAX_ATTEMPTS) {
      await this.prisma.securityOtp.update({
        where: { id: record.id },
        data: { consumed: true },
      });
      throw new BadRequestException('Too many failed attempts. Please request a new verification code.');
    }

    // Verify HMAC hash
    const candidateHash = this.security.hashOtp(cleanPhone, candidateOtp.trim());
    if (candidateHash !== record.tokenHash) {
      await this.prisma.securityOtp.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      const remainingAttempts = this.MAX_ATTEMPTS - (record.attempts + 1);
      throw new BadRequestException(
        `Invalid verification code. ${remainingAttempts} attempts remaining.`,
      );
    }

    // Mark as consumed immediately
    await this.prisma.securityOtp.update({
      where: { id: record.id },
      data: { consumed: true },
    });

    return true;
  }
}
