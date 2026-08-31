import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // List all users in office
  async getOfficeUsers(officeId: string) {
    return this.prisma.user.findMany({
      where: { officeId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Create team member lawyer or admin
  async createOfficeUser(
    officeId: string,
    dto: { name: string; email: string; password: string; role?: Role },
  ) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException('E-mail já cadastrado no sistema');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    return this.prisma.user.create({
      data: {
        officeId,
        name: dto.name,
        email: dto.email.toLowerCase(),
        password: hashedPassword,
        role: dto.role || Role.LAWYER,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });
  }

  // Delete user from office
  async deleteUser(userId: string, officeId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, officeId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return this.prisma.user.delete({
      where: { id: userId },
    });
  }

  // Office statistics for dashboard
  async getOfficeStats(officeId: string) {
    const [totalConversations, totalMessages, totalUsers, totalAssistants] = await Promise.all([
      this.prisma.conversation.count({ where: { officeId } }),
      this.prisma.message.count({ where: { conversation: { officeId } } }),
      this.prisma.user.count({ where: { officeId } }),
      this.prisma.assistant.count({
        where: {
          OR: [{ officeId: null }, { officeId }],
        },
      }),
    ]);

    return {
      totalConversations,
      totalMessages,
      totalUsers,
      totalAssistants,
    };
  }
}
