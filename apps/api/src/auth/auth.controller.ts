import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RequestOtpDto, VerifyOtpDto } from './dto/otp.dto';
import { TwoFactorCodeDto } from './dto/two-factor-code.dto';
import { VerifyTwoFactorLoginDto } from './dto/verify-two-factor-login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { JwtPayload } from './jwt-payload.interface';

// Tighter than the global default (100/min) — these endpoints are exactly what credential
// stuffing / brute-force / OTP-guessing target (PRD §18 Security hardening).
const AUTH_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle(AUTH_THROTTLE)
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @Throttle(AUTH_THROTTLE)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('otp/request')
  @Throttle(AUTH_THROTTLE)
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.authService.requestOtp(dto.phone);
  }

  @Post('otp/verify')
  @Throttle(AUTH_THROTTLE)
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto.phone, dto.code);
  }

  /** Completes login for an account with 2FA enabled — public (no JwtAuthGuard): all the
   * caller has at this point is the short-lived pendingToken from login/otp-verify. */
  @Post('2fa/verify-login')
  @Throttle(AUTH_THROTTLE)
  verifyTwoFactorLogin(@Body() dto: VerifyTwoFactorLoginDto) {
    return this.authService.verifyTwoFactorLogin(dto.pendingToken, dto.code);
  }

  /** PRD §22 "optional 2FA for admins" — enrollment is restricted to OWNER/ADMIN. */
  @Post('2fa/setup')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  setupTwoFactor(@CurrentUser() user: JwtPayload) {
    return this.authService.setupTwoFactor(user.sub);
  }

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Throttle(AUTH_THROTTLE)
  enableTwoFactor(
    @CurrentUser() user: JwtPayload,
    @Body() dto: TwoFactorCodeDto,
  ) {
    return this.authService.enableTwoFactor(user.sub, dto.code);
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @Throttle(AUTH_THROTTLE)
  disableTwoFactor(
    @CurrentUser() user: JwtPayload,
    @Body() dto: TwoFactorCodeDto,
  ) {
    return this.authService.disableTwoFactor(user.sub, dto.code);
  }
}
