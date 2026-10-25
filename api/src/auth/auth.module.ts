import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { MailerModule } from '../mail/mailer.module';
import { AllowedOriginGuard } from '../common/guards/allowed-origin.guard';
import { ExtensionGuard } from '../common/guards/extension.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ExtensionAuthController } from './extension/extension-auth.controller';
import { IpThrottlerGuard } from './ip-throttler.guard';
import { LoginFailureStore } from './login-failure-store';
import { PasswordController } from './password/password.controller';
import { PasswordResetService } from './password/password-reset.service';
import { PasswordService } from './password.service';
import { RATE_LIMITS } from './throttle';
import { RefreshTokenService } from './refresh-token.service';
import { TokenService } from './token.service';

/**
 * AuthModule: web and extension login, refresh rotation, logout, and the global
 * JwtAuthGuard. Every route is authenticated unless it is marked `@Public()`.
 */
@Module({
  imports: [
    MailerModule,
    // Per-endpoint request windows (in memory; single API instance, decision 27).
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const setting = config.get<string>('RATE_LIMITS');
        const off = setting ? setting === 'off' : config.get<string>('NODE_ENV') === 'test';
        return { throttlers: [{ name: 'default', ...RATE_LIMITS.default }], skipIf: () => off };
      },
    }),
  ],
  controllers: [AuthController, ExtensionAuthController, PasswordController],
  providers: [
    // Order matters: the request window is checked before authentication.
    { provide: APP_GUARD, useClass: IpThrottlerGuard },
    AuthService,
    PasswordService,
    TokenService,
    RefreshTokenService,
    LoginFailureStore,
    PasswordResetService,
    AllowedOriginGuard,
    ExtensionGuard,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Runs after JwtAuthGuard: it needs the loaded user to check the capability matrix.
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuthService, PasswordService, TokenService, RefreshTokenService],
})
export class AuthModule {}
