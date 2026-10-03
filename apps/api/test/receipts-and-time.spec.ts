import { describe, it, expect, vi, afterEach } from 'vitest';
import { ReceiptService } from '../src/security/receipt.service';
import { zonedTime, localMinutes } from '../src/bookings/zoned-time';

afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });
describe('private customer receipts', () => {
  it('verifies only the exact tenant, resource and receipt purpose', () => {
    vi.stubEnv('JWT_SECRET', 'test-only-receipt-secret');
    const receipts = new ReceiptService();
    const receipt = receipts.issue('queue', 'tenant-a', 'visit-a');
    expect(() => receipts.verify('queue', 'tenant-a', 'visit-a', receipt)).not.toThrow();
    expect(() => receipts.verify('queue', 'tenant-b', 'visit-a', receipt)).toThrow();
    expect(() => receipts.verify('queue', 'tenant-a', 'visit-b', receipt)).toThrow();
    expect(() => receipts.verify('booking', 'tenant-a', 'visit-a', receipt)).toThrow();
  });
  it('rejects tampering, missing credentials and expired receipts', () => {
    vi.stubEnv('JWT_SECRET', 'test-only-receipt-secret');
    vi.useFakeTimers();
    const receipts = new ReceiptService();
    const receipt = receipts.issue('booking', 'tenant', 'booking');
    expect(() => receipts.verify('booking', 'tenant', 'booking')).toThrow();
    expect(() => receipts.verify('booking', 'tenant', 'booking', `${receipt}a`)).toThrow();
    vi.setSystemTime(Date.now() + 86400000 * 8);
    expect(() => receipts.verify('booking', 'tenant', 'booking', receipt)).toThrow();
  });
  it('fails closed when signing configuration is missing', () => {
    vi.stubEnv('JWT_SECRET', '');
    expect(() => new ReceiptService().issue('queue', 'tenant', 'visit')).toThrow('JWT_SECRET');
  });
});
describe('branch timezone conversion', () => {
  it('stores India and Singapore wall times as correct UTC instants', () => {
    expect(zonedTime('2026-10-10', '09:00', 'Asia/Kolkata').toISOString()).toBe('2026-10-10T03:30:00.000Z');
    expect(zonedTime('2026-10-10', '09:00', 'Asia/Singapore').toISOString()).toBe('2026-10-10T01:00:00.000Z');
  });
  it('handles a UTC date boundary and reads local reservation minutes', () => {
    const instant = zonedTime('2026-10-10', '01:00', 'Asia/Kolkata');
    expect(instant.toISOString()).toBe('2026-10-09T19:30:00.000Z');
    expect(localMinutes(instant, 'Asia/Kolkata')).toBe(60);
  });
});
