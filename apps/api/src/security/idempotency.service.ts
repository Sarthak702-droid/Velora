import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async checkOrRecord(
    key: string,
    method: string,
    path: string,
  ): Promise<{ isExisting: boolean; response?: any }> {
    if (!key) return { isExisting: false };

    const existing = await this.prisma.idempotencyRecord.findUnique({
      where: { key },
    });

    if (existing) {
      if (existing.expiresAt < new Date()) {
        await this.prisma.idempotencyRecord.delete({ where: { id: existing.id } });
        return { isExisting: false };
      }
      return { isExisting: true, response: existing.responseBody };
    }

    return { isExisting: false };
  }

  async saveResponse(
    key: string,
    method: string,
    path: string,
    statusCode: number,
    responseBody: any,
    ttlHours = 24,
  ): Promise<void> {
    if (!key) return;
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

    try {
      await this.prisma.idempotencyRecord.create({
        data: {
          key,
          method,
          path,
          statusCode,
          responseBody,
          expiresAt,
        },
      });
    } catch {
      // Ignore unique constraint race condition
    }
  }
}
