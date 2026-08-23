import { NotificationChannel, ChannelStatus } from './notification-channel.enum';

export interface NotificationPayload {
  userId: number;
  title: string;
  content?: string;
  type?: string;
  relatedId?: number;
  relatedType?: string;
}

export abstract class NotificationProvider {
  abstract readonly channel: NotificationChannel;

  abstract send(payload: NotificationPayload): Promise<ChannelStatus>;
}
