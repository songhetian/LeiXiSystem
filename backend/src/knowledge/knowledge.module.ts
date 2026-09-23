import { Module } from '@nestjs/common';
import { KnowledgeController, KnowledgePublicController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [FilesModule],
  controllers: [KnowledgeController, KnowledgePublicController],
  providers: [KnowledgeService],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
