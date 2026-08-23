export enum NotificationChannel {
  IN_APP = 'in_app',
  EMAIL = 'email',
  SMS = 'sms',
  WECHAT = 'wechat',
}

export type ChannelStatus = 'pending' | 'sent' | 'failed' | 'skipped';

export type NotificationChannels = Record<string, ChannelStatus>;
