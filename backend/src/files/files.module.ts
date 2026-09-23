import { Module } from '@nestjs/common';
import { resolve } from 'path';
import { FilesController } from './files.controller';
import { FilesService, FILE_STORAGE_DIR } from './files.service';

@Module({
  controllers: [FilesController],
  providers: [
    FilesService,
    { provide: FILE_STORAGE_DIR, useValue: resolve(process.cwd(), 'uploads') },
  ],
  exports: [FilesService],
})
export class FilesModule {}