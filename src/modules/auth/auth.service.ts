import { Injectable, UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('E-mail já cadastrado');
    }

    const existingSubdomain = await this.prisma.office.findUnique({
      where: { subdomain: dto.subdomain.toLowerCase() },
    });

    if (existingSubdomain) {
      throw new ConflictException('Subdomínio de escritório já cadastrado');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Create Office & Admin User
    const office = await this.prisma.office.create({
      data: {
        name: dto.officeName,
        subdomain: dto.subdomain.toLowerCase(),
        cnpj: dto.cnpj || null,
        users: {
          create: {
            name: dto.name,
            email: dto.email.toLowerCase(),
            password: hashedPassword,
            role: Role.ADMIN,
          },
        },
      },
      include: {
        users: true,
      },
    });

    const user = office.users[0];
    const tokens = await this.generateTokens(user.id, user.email, user.role, office.id, user.name);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        office: {
          id: office.id,
          name: office.name,
          subdomain: office.subdomain,
        },
      },
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: { office: true },
    });

    if (!user) {
      throw new UnauthorizedException('E-mail ou senha incorretos');
    }

    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('E-mail ou senha incorretos');
    }

    if (!user.office.isActive) {
      throw new UnauthorizedException('Escritório desativado ou suspenso');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role, user.officeId, user.name);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        office: {
          id: user.office.id,
          name: user.office.name,
          subdomain: user.office.subdomain,
        },
      },
      ...tokens,
    };
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || 'portal-ia-advogados-refresh-secret-2026',
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: { office: true },
      });

      if (!user || user.refreshToken !== refreshToken) {
        throw new UnauthorizedException('Token de atualização inválido ou revogado');
      }

      return await this.generateTokens(user.id, user.email, user.role, user.officeId, user.name);
    } catch (e) {
      throw new UnauthorizedException('Sessão expirada. Faça login novamente.');
    }
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        office: {
          select: {
            id: true,
            name: true,
            subdomain: true,
            cnpj: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }

    return user;
  }

  private async generateTokens(
    userId: string,
    email: string,
    role: string,
    officeId: string,
    name: string,
  ) {
    const payload = { sub: userId, email, role, officeId, name };

    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET || 'portal-ia-advogados-super-secret-key-2026',
      expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET || 'portal-ia-advogados-refresh-secret-2026',
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken },
    });

    return {
      accessToken,
      refreshToken,
    };
  }
}
