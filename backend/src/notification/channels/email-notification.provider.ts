import { Injectable } from '@nestjs/common';
import { NotificationProvider, NotificationPayload } from './notification.provider';
import { NotificationChannel, ChannelStatus } from './notification-channel.enum';

@Injectable()
export class EmailNotificationProvider extends NotificationProvider {
  readonly channel = NotificationChannel.EMAIL;

  async send(_payload: NotificationPayload): Promise<ChannelStatus> {
    throw new Error('Email notification provider is not implemented yet');
  }
}
