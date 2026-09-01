import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { TenantModule } from './tenant/tenant.module';
import { AuthModule } from './modules/auth/auth.module';
import { AssistantsModule } from './modules/assistants/assistants.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { AdminModule } from './modules/admin/admin.module';
import { TemplatesModule } from './modules/templates/templates.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    TenantModule,
    AuthModule,
    AssistantsModule,
    ConversationsModule,
    AdminModule,
    TemplatesModule,
  ],
})
export class AppModule {}
