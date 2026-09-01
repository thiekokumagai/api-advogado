import { Module } from '@nestjs/common';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { DocumentParserService } from '../conversations/document-parser.service';

@Module({
  imports: [PrismaModule],
  controllers: [TemplatesController],
  providers: [TemplatesService, DocumentParserService],
  exports: [TemplatesService],
})
export class TemplatesModule {}
