import { Injectable, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

@Injectable()
export class SecurityService {
  private readonly saltRounds = 12;

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  generateSecureToken(bytes = 32): string {
    return crypto.randomBytes(bytes).toString('hex');
  }

  hashOtp(phone: string, otp: string): string {
    const secret = process.env.JWT_SECRET || 'velora_fallback_secret_key';
    return crypto
      .createHmac('sha256', secret)
      .update(`${phone}:${otp}`)
      .digest('hex');
  }

  verifyHmacSignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'utf8'),
        Buffer.from(expectedSignature, 'utf8'),
      );
    } catch {
      return false;
    }
  }

  verifyTenantAccess(authenticatedTenantId?: string, targetTenantId?: string) {
    if (!authenticatedTenantId || !targetTenantId) {
      throw new ForbiddenException('Tenant authorization failed: missing tenant context');
    }
    if (authenticatedTenantId !== targetTenantId) {
      throw new ForbiddenException('Tenant boundary violation: access denied to other tenant data');
    }
  }

  sanitizeString(input: string): string {
    if (!input) return '';
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }
}
