import { Module } from '@nestjs/common';
import { KnowledgeController, KnowledgePublicController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';

@Module({
  controllers: [KnowledgeController, KnowledgePublicController],
  providers: [KnowledgeService],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
