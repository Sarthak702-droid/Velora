import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SendNotificationOptions } from './notification-provider.interface';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  formatMessage(templateKey: string, data: Record<string, any>, salonName: string): string {
    switch (templateKey) {
      case 'BOOKING_CONFIRMED':
        return `Your appointment at ${salonName} is confirmed for ${data.time} on ${data.date}. Stylist: ${data.stylistName || 'Any Available'}.`;
      case 'BOOKING_REMINDER':
        return `Friendly reminder: Your appointment at ${salonName} is in 2 hours at ${data.time}. We look forward to seeing you!`;
      case 'QUEUE_JOINED':
        return `Welcome to ${salonName}! You are #${data.position} in queue (Token ${data.tokenNumber}). Estimated waiting time: ~${data.waitMinutes} minutes. Track live: ${data.trackingUrl || ''}`;
      case 'QUEUE_APPROACHING':
        return `Only 1 guest is ahead of you at ${salonName}. Please stay near the salon floor. Token: ${data.tokenNumber}.`;
      case 'TURN_READY':
        return `Your stylist ${data.stylistName || ''} is ready for you at ${salonName}! Please proceed inside. Token: ${data.tokenNumber}.`;
      case 'SERVICE_DELAY':
        return `Your service at ${salonName} is running approximately ${data.delayMinutes} minutes behind schedule. We apologize for the delay and appreciate your patience!`;
      case 'BOOKING_CANCELLED':
        return `Your booking at ${salonName} for ${data.time} has been cancelled. Reason: ${data.reason || 'Customer request'}.`;
      default:
        return `Update from ${salonName}: ${JSON.stringify(data)}`;
    }
  }

  async sendNotification(
    tenantId: string,
    channel: 'WHATSAPP' | 'SMS' | 'EMAIL',
    recipient: string,
    templateKey: string,
    data: Record<string, any>,
    customerId?: string,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { salonProfile: true },
    });

    const salonName = tenant?.name || 'Velora Salon';
    const content = this.formatMessage(templateKey, data, salonName);

    // Persist notification log
    const notification = await this.prisma.notification.create({
      data: {
        tenantId,
        customerId,
        channel,
        recipient,
        templateKey,
        content,
        status: 'SENT',
        sentAt: new Date(),
      },
    });

    // In production, connects to WhatsApp Cloud API / Resend HTTP clients
    this.logger.log(
      JSON.stringify({
        event: 'NOTIFICATION_DISPATCHED',
        notificationId: notification.id,
        channel,
        recipient: recipient.slice(-4),
        templateKey,
      }),
    );

    return notification;
  }

  async getTenantNotifications(tenantId: string, limit = 50) {
    return this.prisma.notification.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { customer: true },
    });
  }
}
