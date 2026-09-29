import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { PublicSystemInfoController } from './public-system-info.controller';
import { SettingsService } from './settings.service';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [FilesModule],
  controllers: [SettingsController, PublicSystemInfoController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
