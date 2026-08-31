import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, UserPayload } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  getOfficeUsers(@CurrentUser() user: UserPayload) {
    return this.adminService.getOfficeUsers(user.officeId);
  }

  @Post('users')
  createOfficeUser(
    @Body() dto: { name: string; email: string; password: string; role?: Role },
    @CurrentUser() user: UserPayload,
  ) {
    return this.adminService.createOfficeUser(user.officeId, dto);
  }

  @Delete('users/:id')
  deleteUser(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    return this.adminService.deleteUser(id, user.officeId);
  }

  @Get('stats')
  getOfficeStats(@CurrentUser() user: UserPayload) {
    return this.adminService.getOfficeStats(user.officeId);
  }
}
