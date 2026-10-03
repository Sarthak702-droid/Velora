export interface SendNotificationOptions {
  recipient: string; // phone number or email
  templateKey: string;
  data: Record<string, string | number>;
  salonName: string;
}

export interface NotificationProvider {
  channel: 'WHATSAPP' | 'SMS' | 'EMAIL';
  send(options: SendNotificationOptions): Promise<{ success: boolean; externalId?: string; error?: string }>;
}
