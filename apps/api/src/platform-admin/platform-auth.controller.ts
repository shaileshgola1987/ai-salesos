import { Body, Controller, Post } from '@nestjs/common';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformLoginDto } from './dto/platform-login.dto';

@Controller('platform/auth')
export class PlatformAuthController {
  constructor(private readonly platformAuthService: PlatformAuthService) {}

  @Post('login')
  login(@Body() dto: PlatformLoginDto) {
    return this.platformAuthService.login(dto.email, dto.password);
  }
}
