import { Body, Controller, HttpCode, Inject, Post, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import {
  ChangePasswordRequestSchema,
  ForgotPasswordRequestSchema,
  ResetPasswordRequestSchema,
  type ChangePasswordRequest,
  type ForgotPasswordRequest,
  type ForgotPasswordResponse,
  type LoginResponse,
  type ResetPasswordRequest,
} from '@hares/contract';
import type { AuthUser } from '../../common/auth-user';
import { CurrentUser, Public } from '../../common/decorators/auth.decorators';
import { AllowedOriginGuard } from '../../common/guards/allowed-origin.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthService } from '../auth.service';
import { setRefreshCookie } from '../refresh-cookie';
import { RATE_LIMITS } from '../throttle';
import { PasswordResetService } from './password-reset.service';

/** `/api/auth/forgot-password`, `/reset-password`, `/change-password`. */
@UseGuards(AllowedOriginGuard)
@Controller('auth')
export class PasswordController {
  private readonly secureCookie: boolean;

  constructor(
    @Inject(PasswordResetService) private readonly reset: PasswordResetService,
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(ConfigService) config: ConfigService,
  ) {
    this.secureCookie = config.get<boolean>('COOKIE_SECURE') ?? config.get<string>('NODE_ENV') === 'production';
  }

  /** Same 202 for every email, registered or not (decision 29). */
  @Public()
  @Throttle({ default: RATE_LIMITS.forgotPassword })
  @Post('forgot-password')
  @HttpCode(202)
  forgot(
    @Body(new ZodValidationPipe(ForgotPasswordRequestSchema)) body: ForgotPasswordRequest,
  ): ForgotPasswordResponse {
    this.reset.requestReset(body.email);
    return { status: 'accepted' };
  }

  @Public()
  @Throttle({ default: RATE_LIMITS.resetPassword })
  @Post('reset-password')
  @HttpCode(204)
  async resetPassword(
    @Body(new ZodValidationPipe(ResetPasswordRequestSchema)) body: ResetPasswordRequest,
  ): Promise<void> {
    await this.reset.reset(body.token, body.new_password);
  }

  /** WEB-FR-058: every old session ends; this device gets a new one. */
  @Throttle({ default: RATE_LIMITS.changePassword })
  @Post('change-password')
  @HttpCode(200)
  async change(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(ChangePasswordRequestSchema)) body: ChangePasswordRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    await this.reset.change(user.id, body.current_password, body.new_password);
    const session = await this.auth.newSession(user.id, 'web');
    setRefreshCookie(res, session.refreshToken, this.secureCookie);
    return session.body;
  }
}
