import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DocumentParserService } from '../conversations/document-parser.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

@Injectable()
export class TemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documentParserService: DocumentParserService,
  ) {}

  async parseFile(file: Express.Multer.File): Promise<{ extractedText: string; filename: string; mimetype: string }> {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo foi enviado.');
    }

    const extractedText = await this.documentParserService.parseBuffer(
      file.buffer,
      file.mimetype,
      file.originalname,
    );

    return {
      extractedText,
      filename: file.originalname,
      mimetype: file.mimetype,
    };
  }

  async findAll(officeId: string) {
    return (this.prisma as any).contractTemplate.findMany({
      where: { officeId },
      orderBy: [
        { category: 'asc' },
        { updatedAt: 'desc' },
      ],
    });
  }

  async findOne(id: string, officeId: string) {
    const template = await (this.prisma as any).contractTemplate.findFirst({
      where: { id, officeId },
    });

    if (!template) {
      throw new NotFoundException('Modelo de contrato não encontrado.');
    }

    return template;
  }

  async create(dto: CreateTemplateDto, officeId: string) {
    return (this.prisma as any).contractTemplate.create({
      data: {
        title: dto.title,
        category: dto.category || 'Geral',
        description: dto.description,
        fileType: dto.fileType || 'manual',
        content: dto.content,
        officeId,
      },
    });
  }

  async update(id: string, dto: UpdateTemplateDto, officeId: string) {
    await this.findOne(id, officeId);

    return (this.prisma as any).contractTemplate.update({
      where: { id },
      data: {
        ...dto,
      },
    });
  }

  async remove(id: string, officeId: string) {
    await this.findOne(id, officeId);

    return (this.prisma as any).contractTemplate.delete({
      where: { id },
    });
  }
}
