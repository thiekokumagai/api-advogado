import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OpenAiService, ChatContextItem } from './openai.service';
import { DocumentParserService } from './document-parser.service';
import { DocumentExporterService } from './document-exporter.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly openAiService: OpenAiService,
    private readonly documentParserService: DocumentParserService,
    private readonly documentExporterService: DocumentExporterService,
  ) {}

  async create(dto: CreateConversationDto, officeId: string, userId: string) {
    const assistant = await this.prisma.assistant.findFirst({
      where: {
        id: dto.assistantId,
        OR: [{ officeId: null }, { officeId: officeId }],
      },
    });

    if (!assistant) {
      throw new NotFoundException('Assistente selecionado não foi encontrado');
    }

    const title = dto.title || `Nova conversa com ${assistant.name}`;

    return this.prisma.conversation.create({
      data: {
        officeId,
        userId,
        assistantId: assistant.id,
        title,
      },
      include: {
        assistant: true,
        messages: true,
        attachments: true,
      },
    });
  }

  async findAll(officeId: string, userId: string) {
    return this.prisma.conversation.findMany({
      where: {
        officeId,
        userId,
      },
      include: {
        assistant: {
          select: { id: true, name: true, icon: true, category: true },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { messages: true, attachments: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(id: string, officeId: string, userId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id,
        officeId,
      },
      include: {
        assistant: true,
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        attachments: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversa não encontrada');
    }

    return conversation;
  }

  async delete(id: string, officeId: string, userId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id, officeId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversa não encontrada');
    }

    return this.prisma.conversation.delete({
      where: { id },
    });
  }

  // Upload PDF or DOCX attachment per conversation
  async uploadAttachment(
    conversationId: string,
    officeId: string,
    userId: string,
    file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo enviado');
    }

    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, officeId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversa não encontrada');
    }

    // Extract text from buffer using parser service
    const extractedText = await this.documentParserService.parseBuffer(
      file.buffer,
      file.mimetype,
      file.originalname,
    );

    // Save upload to local uploads folder
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const fileExt = file.originalname.split('.').pop() || '';
    const safeFileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = path.join('uploads', safeFileName);
    fs.writeFileSync(path.join(process.cwd(), filePath), file.buffer);

    const attachment = await this.prisma.attachment.create({
      data: {
        conversationId,
        fileName: file.originalname,
        fileType: fileExt.toLowerCase().includes('pdf') ? 'pdf' : 'docx',
        fileSize: file.size,
        filePath,
        extractedText,
      },
    });

    return attachment;
  }

  // Send message in chat with dynamic prompt resolution
  async sendMessage(
    conversationId: string,
    officeId: string,
    userId: string,
    dto: SendMessageDto,
  ) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, officeId },
      include: {
        assistant: true,
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        attachments: true,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversa não encontrada');
    }

    // Save User message
    const userMessage = await this.prisma.message.create({
      data: {
        conversationId,
        role: 'user',
        content: dto.content,
      },
    });

    // Format chat history for OpenAI context
    const historyPayload: ChatContextItem[] = conversation.messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // Fetch office contract templates to provide context to the AI
    const officeTemplates = await (this.prisma as any).contractTemplate.findMany({
      where: { officeId },
      select: { title: true, category: true, content: true },
    });

    let systemPromptWithTemplates = conversation.assistant.systemPrompt;

    if (officeTemplates && officeTemplates.length > 0) {
      const templatesContext = officeTemplates
        .map(
          (t: any, idx: number) =>
            `--- MODELO DE CONTRATO ${idx + 1}: "${t.title}" (Categoria: ${t.category}) ---\n${t.content}`,
        )
        .join('\n\n');

      systemPromptWithTemplates += `\n\n=== MODELOS DE CONTRATOS PADRÃO CADASTRADOS NO ESCRITÓRIO DO USUÁRIO ===\nO escritório possui ${officeTemplates.length} modelo(s) oficial(is) cadastrado(s) abaixo. Se o usuário pedir para transformar, modernizar ou gerar um contrato com base em seus modelos padrão (ou citar um nome/categoria), utilize a estrutura e cláusulas do modelo correspondente como padrão:\n\n${templatesContext}\n==================================================================`;
    }

    // Generate response using assistant system prompt and attachments
    const aiResult = await this.openAiService.generateCompletion(
      systemPromptWithTemplates,
      historyPayload,
      dto.content,
      conversation.attachments.map((a) => ({
        fileName: a.fileName,
        extractedText: a.extractedText,
      })),
    );

    // Save Assistant message
    const assistantMessage = await this.prisma.message.create({
      data: {
        conversationId,
        role: 'assistant',
        content: aiResult.content,
        tokensUsed: aiResult.tokensUsed || null,
      },
    });

    // Update conversation title if default title
    let newTitle = conversation.title;
    if (conversation.messages.length === 0 && dto.content.length > 5) {
      newTitle = dto.content.substring(0, 45).trim() + '...';
    }

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        title: newTitle,
        updatedAt: new Date(),
      },
    });

    return {
      userMessage,
      assistantMessage,
    };
  }

  // Export specific message or full transcript to DOCX or PDF
  async exportMessage(
    conversationId: string,
    messageId: string,
    format: 'pdf' | 'docx',
    officeId: string,
  ) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, officeId },
      include: { assistant: true },
    });

    if (!conversation) {
      throw new NotFoundException('Conversa não encontrada');
    }

    const message = await this.prisma.message.findFirst({
      where: { id: messageId, conversationId },
    });

    if (!message) {
      throw new NotFoundException('Mensagem não encontrada');
    }

    const title = conversation.title || 'Documento Jurídico';
    const assistantName = conversation.assistant.name;

    if (format === 'docx') {
      const buffer = await this.documentExporterService.generateDocx(
        title,
        message.content,
        assistantName,
      );
      return {
        buffer,
        mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        filename: `${title.replace(/[^a-zA-Z0-9]/g, '_')}.docx`,
      };
    } else {
      const buffer = await this.documentExporterService.generatePdf(
        title,
        message.content,
        assistantName,
      );
      return {
        buffer,
        mimetype: 'application/pdf',
        filename: `${title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
      };
    }
  }
}
