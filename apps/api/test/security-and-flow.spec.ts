import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient, UserRole } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { SecurityService } from '../src/security/security.service';
import { DynamicSlotEngine } from '../src/bookings/dynamic-slot.engine';
import { EtaEngineService } from '../src/flow/eta-engine.service';
import { QueueService } from '../src/queue/queue.service';

describe('Velora Security Architecture & Core Flow Tests', () => {
  let pool: Pool;
  let prisma: any;
  let securityService: SecurityService;
  let slotEngine: DynamicSlotEngine;
  let etaEngine: EtaEngineService;
  let tenantId: string;
  let branchId: string;

  beforeAll(async () => {
    pool = new Pool({
      connectionString:
        process.env.DATABASE_URL ||
        'postgresql://postgres:postgres@localhost:5432/velora?schema=public',
    });
    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter });

    securityService = new SecurityService();
    slotEngine = new DynamicSlotEngine(prisma);
    etaEngine = new EtaEngineService(prisma);

    const tenant = await prisma.tenant.findUnique({
      where: { slug: 'velora-signature' },
      include: { branches: true },
    });
    expect(tenant).toBeDefined();
    tenantId = tenant!.id;
    branchId = tenant!.branches[0].id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

  describe('1. Tenant Isolation & Security (Section 85.3, 86.13)', () => {
    it('should forbid cross-tenant data access', () => {
      const userTenantId = 'tenant_salon_a';
      const foreignTenantId = 'tenant_salon_b';

      expect(() => {
        securityService.verifyTenantAccess(userTenantId, foreignTenantId);
      }).toThrow('Tenant boundary violation');
    });

    it('should verify timing-safe HMAC signature for webhooks and payment gateways', () => {
      const secret = 'velora_webhook_secret_key';
      const payload = JSON.stringify({ event: 'payment.captured', orderId: 'order_123' });
      const validSignature = require('crypto')
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      const isValid = securityService.verifyHmacSignature(payload, validSignature, secret);
      expect(isValid).toBe(true);

      const isInvalid = securityService.verifyHmacSignature(payload, 'tampered_signature', secret);
      expect(isInvalid).toBe(false);
    });

    it('should sanitize user input strings against XSS attacks', () => {
      const maliciousInput = '<script>alert("hack")</script>';
      const sanitized = securityService.sanitizeString(maliciousInput);
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toBe('&lt;script&gt;alert(&quot;hack&quot;)&lt;&#x2F;script&gt;');
    });
  });

  describe('2. Public Queue Privacy (Section 18, 85.25)', () => {
    it('should NEVER expose other customer names, phones, or notes in public queue status', async () => {
      const dummyEvents: any = { broadcastQueueUpdated: () => {}, broadcastTokenUpdated: () => {} };
      const dummyAudit: any = { log: async () => {} };
      const queueService = new QueueService(prisma, dummyEvents, dummyAudit);

      const status = await queueService.getPublicQueueStatus(tenantId, 'V002');

      expect(status.tokenNumber).toBe('V002');
      expect(status.position).toBeDefined();
      expect(status.guestsAhead).toBeDefined();
      expect(status.estimatedWaitMinutes).toBeGreaterThanOrEqual(0);
      expect(status.status).toBe('WAITING');

      // Crucial privacy guarantees:
      expect((status as any).customerName).toBeUndefined();
      expect((status as any).customerPhone).toBeUndefined();
      expect((status as any).phone).toBeUndefined();
      expect((status as any).notes).toBeUndefined();
    });
  });

  describe('3. Dynamic Slot Engine (Section 8)', () => {
    it('should calculate dynamic slots considering service duration, buffer, and staff schedules', async () => {
      const services = await prisma.service.findMany({
        where: { tenantId, active: true },
        take: 2,
      });

      const serviceIds = services.map((s: any) => s.id);
      const nextWednesday = '2026-10-07'; // Wednesday (salon open, not holiday)

      const slots = await slotEngine.calculateAvailableSlots({
        tenantId,
        branchId,
        serviceIds,
        dateStr: nextWednesday,
        staffId: 'any',
      });

      expect(slots.length).toBeGreaterThan(0);
      expect(slots[0]).toHaveProperty('time');
      expect(slots[0]).toHaveProperty('staffId');
      expect(slots[0]).toHaveProperty('staffName');
    });

    it('should return 0 slots for weekly holidays (Tuesday closed)', async () => {
      const services = await prisma.service.findMany({
        where: { tenantId },
        take: 1,
      });
      const tuesdayDate = '2026-10-06'; // Tuesday

      const slots = await slotEngine.calculateAvailableSlots({
        tenantId,
        branchId,
        serviceIds: [services[0].id],
        dateStr: tuesdayDate,
        staffId: 'any',
      });

      expect(slots).toEqual([]);
    });
  });

  describe('4. Deterministic ETA Engine (Section 25)', () => {
    it('should calculate deterministic wait time based on remaining duration + guests ahead', async () => {
      const entry = await prisma.queueEntry.findFirst({
        where: { tenantId, branchId, tokenNumber: 'V002' },
      });

      expect(entry).toBeDefined();

      const eta = await etaEngine.calculateQueueEta(tenantId, branchId, entry!.id);

      expect(eta).toHaveProperty('remainingCurrentServiceMinutes');
      expect(eta).toHaveProperty('aheadDurationMinutes');
      expect(eta).toHaveProperty('bufferMinutes');
      expect(eta).toHaveProperty('totalEstimatedWaitMinutes');
      expect(eta.estimatedStartTime).toBeInstanceOf(Date);
    });
  });
});
