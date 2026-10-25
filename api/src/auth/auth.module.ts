import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AllowedOriginGuard } from '../common/guards/allowed-origin.guard';
import { ExtensionGuard } from '../common/guards/extension.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ExtensionAuthController } from './extension/extension-auth.controller';
import { PasswordService } from './password.service';
import { RefreshTokenService } from './refresh-token.service';
import { TokenService } from './token.service';

/**
 * AuthModule: web and extension login, refresh rotation, logout, and the global
 * JwtAuthGuard. Every route is authenticated unless it is marked `@Public()`.
 */
@Module({
  controllers: [AuthController, ExtensionAuthController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    RefreshTokenService,
    AllowedOriginGuard,
    ExtensionGuard,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [AuthService, PasswordService, TokenService, RefreshTokenService],
})
export class AuthModule {}
