import { Module } from '@nestjs/common';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { OpenAiService } from './openai.service';
import { DocumentParserService } from './document-parser.service';
import { DocumentExporterService } from './document-exporter.service';

@Module({
  controllers: [ConversationsController],
  providers: [
    ConversationsService,
    OpenAiService,
    DocumentParserService,
    DocumentExporterService,
  ],
  exports: [ConversationsService],
})
export class ConversationsModule {}
