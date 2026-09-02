import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  Patch,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AiProviderName } from '@prisma/client';
import { PlatformAdminGuard } from './guards/platform-admin.guard';
import { AiProviderConfigService } from './ai-provider-config.service';
import { UpsertAiProviderDto } from './dto/upsert-ai-provider.dto';
import { SetActiveProviderDto } from './dto/set-active-provider.dto';

/**
 * Platform-wide AI provider settings — which LLM (Anthropic/OpenAI/Gemini/...) every
 * organization's AI Lead Scoring, summaries, follow-up and reply suggestions run on, and
 * that provider's API key. Guarded by PlatformAdminGuard only: no Organization role
 * (OWNER/ADMIN included) can reach these routes, by design.
 */
@Controller('platform/ai-settings')
@UseGuards(PlatformAdminGuard)
export class AiSettingsController {
  constructor(
    private readonly aiProviderConfigService: AiProviderConfigService,
  ) {}

  @Get()
  list() {
    return this.aiProviderConfigService.list();
  }

  @Put(':provider')
  upsert(
    @Param('provider', new ParseEnumPipe(AiProviderName))
    provider: AiProviderName,
    @Body() dto: UpsertAiProviderDto,
  ) {
    return this.aiProviderConfigService.upsert(provider, dto.apiKey, dto.model);
  }

  @Delete(':provider')
  remove(
    @Param('provider', new ParseEnumPipe(AiProviderName))
    provider: AiProviderName,
  ) {
    return this.aiProviderConfigService.remove(provider);
  }

  @Patch('active')
  setActive(@Body() dto: SetActiveProviderDto) {
    return this.aiProviderConfigService.setActive(dto.provider);
  }
}
