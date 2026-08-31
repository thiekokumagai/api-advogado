import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, UserPayload } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post()
  create(@Body() dto: CreateConversationDto, @CurrentUser() user: UserPayload) {
    return this.conversationsService.create(dto, user.officeId, user.sub);
  }

  @Get()
  findAll(@CurrentUser() user: UserPayload) {
    return this.conversationsService.findAll(user.officeId, user.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    return this.conversationsService.findOne(id, user.officeId, user.sub);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    return this.conversationsService.delete(id, user.officeId, user.sub);
  }

  @Post(':id/messages')
  sendMessage(
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.conversationsService.sendMessage(id, user.officeId, user.sub, dto);
  }

  @Post(':id/attachments')
  @UseInterceptors(FileInterceptor('file'))
  uploadAttachment(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: UserPayload,
  ) {
    return this.conversationsService.uploadAttachment(id, user.officeId, user.sub, file);
  }

  @Get(':id/messages/:messageId/export')
  async exportMessage(
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @Query('format') format: 'pdf' | 'docx' = 'docx',
    @CurrentUser() user: UserPayload,
    @Res() res: Response,
  ) {
    const fileResult = await this.conversationsService.exportMessage(
      id,
      messageId,
      format,
      user.officeId,
    );

    res.setHeader('Content-Type', fileResult.mimetype);
    res.setHeader('Content-Disposition', `attachment; filename="${fileResult.filename}"`);
    return res.send(fileResult.buffer);
  }
}
