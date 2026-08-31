import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AssistantsService } from './assistants.service';
import { CreateAssistantDto } from './dto/create-assistant.dto';
import { UpdateAssistantDto } from './dto/update-assistant.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, UserPayload } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('assistants')
export class AssistantsController {
  constructor(private readonly assistantsService: AssistantsService) {}

  @Get()
  findAll(@CurrentUser() user: UserPayload) {
    return this.assistantsService.findAllAvailable(user.officeId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    return this.assistantsService.findOne(id, user.officeId);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Post()
  create(@Body() dto: CreateAssistantDto, @CurrentUser() user: UserPayload) {
    const isGlobal = user.role === Role.SUPER_ADMIN;
    return this.assistantsService.create(dto, user.officeId, isGlobal);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAssistantDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.assistantsService.update(id, dto, user.officeId);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    return this.assistantsService.remove(id, user.officeId);
  }
}
