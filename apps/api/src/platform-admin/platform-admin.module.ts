import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PlatformAuthController } from './platform-auth.controller';
import { PlatformAuthService } from './platform-auth.service';
import { AiSettingsController } from './ai-settings.controller';
import { AiProviderConfigService } from './ai-provider-config.service';

@Module({
  imports: [ConfigModule],
  controllers: [PlatformAuthController, AiSettingsController],
  providers: [PlatformAuthService, AiProviderConfigService],
})
export class PlatformAdminModule {}
