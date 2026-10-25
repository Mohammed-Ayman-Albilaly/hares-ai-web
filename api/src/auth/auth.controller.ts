import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import {
  LoginRequestSchema,
  LogoutRequestSchema,
  RefreshRequestSchema,
  RegisterRequestSchema,
  type LoginRequest,
  type LoginResponse,
  type MeResponse,
  type RefreshResponse,
  type RegisterRequest,
  type RegisterResponse,
} from '@hares/contract';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser, Public } from '../common/decorators/auth.decorators';
import { AllowedOriginGuard } from '../common/guards/allowed-origin.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AuthService } from './auth.service';
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from './refresh-cookie';

/**
 * Web session endpoints (`/api/auth/*`). The extension has its own routes.
 * Every route checks the browser Origin (AllowedOriginGuard): this blocks
 * login CSRF (a foreign page posting a form with the attacker's credentials)
 * and cookie misuse on refresh/logout.
 */
@UseGuards(AllowedOriginGuard)
@Controller('auth')
export class AuthController {
  private readonly secureCookie: boolean;

  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(ConfigService) config: ConfigService,
  ) {
    this.secureCookie = config.get<boolean>('COOKIE_SECURE') ?? config.get<string>('NODE_ENV') === 'production';
  }

  @Public()
  @Post('register')
  @HttpCode(201)
  async register(
    @Body(new ZodValidationPipe(RegisterRequestSchema)) body: RegisterRequest,
  ): Promise<RegisterResponse> {
    await this.auth.register(body);
    return { status: 'PENDING' };
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(LoginRequestSchema)) body: LoginRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    const session = await this.auth.login(body, 'web');
    setRefreshCookie(res, session.refreshToken, this.secureCookie);
    return session.body;
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Body(new ZodValidationPipe(RefreshRequestSchema.optional())) _body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RefreshResponse> {
    try {
      const session = await this.auth.refresh(readRefreshCookie(req), 'web');
      setRefreshCookie(res, session.refreshToken, this.secureCookie);
      return session.body;
    } catch (e) {
      // A dead refresh cookie is useless; drop it so the SPA goes to login.
      // Other errors (e.g. a database blip) keep the cookie so the user stays signed in.
      if (e instanceof UnauthorizedException) clearRefreshCookie(res, this.secureCookie);
      throw e;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Body(new ZodValidationPipe(LogoutRequestSchema.optional())) _body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(readRefreshCookie(req), 'web');
    clearRefreshCookie(res, this.secureCookie);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser): Promise<MeResponse> {
    return this.auth.me(user.id);
  }
}
