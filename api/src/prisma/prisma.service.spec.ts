import { describe, it, expect, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';

vi.mock('@prisma/adapter-pg', () => ({
  PrismaPg: vi.fn().mockImplementation((config: { connectionString: string }) => ({
    provider: 'postgres',
    adapterName: '@prisma/adapter-pg',
    config,
    connect: async () => ({}),
    dispose: async () => {},
  })),
}));

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaService } from './prisma.service';

const APP_URL = 'postgresql://hares_app:secret@localhost:5432/hares';

function configService(values: Record<string, unknown>): ConfigService {
  return {
    getOrThrow: vi.fn((key: string) => {
      if (!(key in values)) throw new Error(`Config key "${key}" is missing`);
      return values[key];
    }),
  } as unknown as ConfigService;
}

describe('PrismaService', () => {
  it('connects using APP_DATABASE_URL from the config (no hardcoded default)', () => {
    new PrismaService(configService({ APP_DATABASE_URL: APP_URL }));

    expect(PrismaPg).toHaveBeenCalledTimes(1);
    const arg = (PrismaPg as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(arg.connectionString).toBe(APP_URL);
  });

  it('fails fast when APP_DATABASE_URL is not configured', () => {
    expect(() => new PrismaService(configService({}))).toThrow(/APP_DATABASE_URL/);
  });
});
