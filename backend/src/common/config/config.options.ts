import { ConfigModuleOptions } from '@nestjs/config';
import { envSchema } from './env.validation';

/**
 * ConfigModule 全局配置（T19.2）。
 * validate 在启动期对 env 做 fail-fast 校验：非法 env 直接抛错，不静默启动。
 */
export const configModuleOptions: ConfigModuleOptions = {
  isGlobal: true,
  validate: (config) => envSchema.parse(config),
};
