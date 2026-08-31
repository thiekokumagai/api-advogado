import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAssistantDto } from './dto/create-assistant.dto';
import { UpdateAssistantDto } from './dto/update-assistant.dto';

@Injectable()
export class AssistantsService {
  constructor(private readonly prisma: PrismaService) {}

  // List all active assistants available to the office (global + office-specific)
  async findAllAvailable(officeId: string) {
    return this.prisma.assistant.findMany({
      where: {
        isActive: true,
        OR: [
          { officeId: null },
          { officeId: officeId },
        ],
      },
      orderBy: [
        { order: 'asc' },
        { name: 'asc' },
      ],
    });
  }

  // Get assistant by ID
  async findOne(id: string, officeId: string) {
    const assistant = await this.prisma.assistant.findFirst({
      where: {
        id,
        OR: [
          { officeId: null },
          { officeId: officeId },
        ],
      },
    });

    if (!assistant) {
      throw new NotFoundException('Assistente não encontrado');
    }

    return assistant;
  }

  // Admin: Create new assistant for office or global
  async create(dto: CreateAssistantDto, officeId: string, isGlobal = false) {
    return this.prisma.assistant.create({
      data: {
        name: dto.name,
        icon: dto.icon,
        description: dto.description,
        systemPrompt: dto.systemPrompt,
        category: dto.category || 'Geral',
        isActive: dto.isActive !== undefined ? dto.isActive : true,
        order: dto.order || 0,
        officeId: isGlobal ? null : officeId,
      },
    });
  }

  // Admin: Update assistant with office tenant verification
  async update(id: string, dto: UpdateAssistantDto, officeId: string, isSuperAdmin = false) {
    const assistant = await this.prisma.assistant.findUnique({
      where: { id },
    });

    if (!assistant) {
      throw new NotFoundException('Assistente não encontrado');
    }

    // Check ownership: non-SuperAdmins can only update assistants created by their own office
    if (!isSuperAdmin && assistant.officeId !== officeId) {
      throw new ForbiddenException('Você não tem permissão para alterar assistentes globais ou de outro escritório');
    }

    return this.prisma.assistant.update({
      where: { id },
      data: {
        ...dto,
      },
    });
  }

  // Admin: Delete assistant with office tenant verification
  async remove(id: string, officeId: string, isSuperAdmin = false) {
    const assistant = await this.prisma.assistant.findUnique({
      where: { id },
    });

    if (!assistant) {
      throw new NotFoundException('Assistente não encontrado');
    }

    // Check ownership: non-SuperAdmins can only delete assistants created by their own office
    if (!isSuperAdmin && assistant.officeId !== officeId) {
      throw new ForbiddenException('Você não tem permissão para excluir assistentes globais ou de outro escritório');
    }

    return this.prisma.assistant.delete({
      where: { id },
    });
  }
}
