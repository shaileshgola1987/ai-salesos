import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { UsersModule } from './users/users.module';
import { LeadsModule } from './leads/leads.module';
import { PipelineStagesModule } from './pipeline-stages/pipeline-stages.module';
import { TasksModule } from './tasks/tasks.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';
import { ProductsModule } from './products/products.module';
import { QuotationsModule } from './quotations/quotations.module';
import { PlatformAdminModule } from './platform-admin/platform-admin.module';
import { VisitsModule } from './visits/visits.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Global default: 100 requests/minute per IP. Sensitive auth endpoints (login, register,
    // OTP, 2FA) set a much stricter per-route @Throttle to blunt brute-force/credential
    // stuffing (PRD §18 Security hardening) without punishing normal API usage elsewhere.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    OrganizationsModule,
    UsersModule,
    LeadsModule,
    PipelineStagesModule,
    TasksModule,
    DashboardModule,
    WhatsAppModule,
    ProductsModule,
    QuotationsModule,
    PlatformAdminModule,
    VisitsModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
