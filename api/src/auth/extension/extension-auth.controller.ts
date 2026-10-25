import { Body, Controller, HttpCode, Inject, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import {
  ExtensionLoginRequestSchema,
  ExtensionLogoutRequestSchema,
  ExtensionRefreshRequestSchema,
  type ExtensionAuthResponse,
  type ExtensionLoginRequest,
  type ExtensionLogoutRequest,
  type ExtensionRefreshRequest,
} from '@hares/contract';
import { Public } from '../../common/decorators/auth.decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { unauthorized } from '../auth-errors';
import { AuthService, type SessionResult } from '../auth.service';
import { clientIp } from '../client-ip';
import { RATE_LIMITS } from '../throttle';

/**
 * Extension token lifecycle (`/api/extension/*`, ARCHITECTURE §7(b)).
 *
 * The extension cannot use cookies, so the rotating refresh token travels in
 * the JSON body and is kept in extension storage. The access token lives at
 * most 1 hour (decision 30) and has `aud = extension`, so it is refused by
 * every web route; web tokens are refused here in the same way.
 * The extension never stores the user's password.
 */
@Controller('extension')
export class ExtensionAuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: RATE_LIMITS.login })
  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(ExtensionLoginRequestSchema)) body: ExtensionLoginRequest,
    @Req() req: Request,
  ): Promise<ExtensionAuthResponse> {
    return toExtensionResponse(await this.auth.login(body, 'extension', clientIp(req)));
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Body(new ZodValidationPipe(ExtensionRefreshRequestSchema)) body: ExtensionRefreshRequest,
  ): Promise<ExtensionAuthResponse> {
    return toExtensionResponse(await this.auth.refresh(body.refresh_token, 'extension'));
  }

  /** WEB-FR-071: revoke the whole family. 401 when the token is unknown or already revoked. */
  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Body(new ZodValidationPipe(ExtensionLogoutRequestSchema)) body: ExtensionLogoutRequest,
  ): Promise<void> {
    if (!(await this.auth.logout(body.refresh_token, 'extension'))) {
      throw unauthorized('INVALID_TOKEN');
    }
  }
}

function toExtensionResponse(session: SessionResult): ExtensionAuthResponse {
  return {
    access_token: session.body.access_token,
    refresh_token: session.refreshToken,
    expires_in: session.body.expires_in,
  };
}
