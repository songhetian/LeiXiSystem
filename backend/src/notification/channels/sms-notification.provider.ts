import { Injectable } from '@nestjs/common';
import { NotificationProvider, NotificationPayload } from './notification.provider';
import { NotificationChannel, ChannelStatus } from './notification-channel.enum';

@Injectable()
export class SmsNotificationProvider extends NotificationProvider {
  readonly channel = NotificationChannel.SMS;

  async send(_payload: NotificationPayload): Promise<ChannelStatus> {
    throw new Error('SMS notification provider is not implemented yet');
  }
}
