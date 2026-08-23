import { Injectable } from '@nestjs/common';
import { NotificationProvider, NotificationPayload } from './notification.provider';
import { NotificationChannel, ChannelStatus } from './notification-channel.enum';

@Injectable()
export class InAppNotificationProvider extends NotificationProvider {
  readonly channel = NotificationChannel.IN_APP;

  async send(_payload: NotificationPayload): Promise<ChannelStatus> {
    return 'sent';
  }
}
