import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ModulesContainer } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import type { Capability } from '@hares/contract';
import { CLIENT_KIND_KEY, IS_PUBLIC_KEY } from '../common/decorators/auth.decorators';
import { CAPABILITY_KEY } from '../common/decorators/roles.decorator';

export interface RouteInfo {
  method: string;
  /** Full path under /api with `:params` replaced by a random-looking UUID. */
  path: string;
  rawPath: string;
  capability?: Capability;
  isPublic: boolean;
  client: 'web' | 'extension';
}

const SAMPLE_ID = '00000000-0000-4000-8000-000000000000';

function joinPath(...parts: string[]): string {
  return (
    '/' +
    parts
      .flatMap((p) => p.split('/'))
      .filter(Boolean)
      .join('/')
  );
}

/** Every HTTP route the app registers, with its auth metadata (for the matrix spec). */
export function routeTable(app: INestApplication): RouteInfo[] {
  const routes: RouteInfo[] = [];
  for (const mod of app.get(ModulesContainer).values()) {
    for (const wrapper of mod.controllers.values()) {
      const ctrl = wrapper.metatype as (new (...args: unknown[]) => unknown) | null;
      if (!ctrl) continue;
      const base = (Reflect.getMetadata(PATH_METADATA, ctrl) as string | undefined) ?? '';
      // Include handlers inherited from base controller classes.
      const names = new Set<string>();
      for (let p = ctrl.prototype as object | null; p && p !== Object.prototype; p = Object.getPrototypeOf(p)) {
        for (const n of Object.getOwnPropertyNames(p)) names.add(n);
      }
      for (const name of names) {
        if (name === 'constructor') continue;
        const handler = (ctrl.prototype as Record<string, unknown>)[name];
        if (typeof handler !== 'function') continue;
        const sub = Reflect.getMetadata(PATH_METADATA, handler) as string | undefined;
        const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
        if (sub === undefined || method === undefined) continue;
        const pick = <T>(key: string): T | undefined =>
          (Reflect.getMetadata(key, handler) as T | undefined) ?? (Reflect.getMetadata(key, ctrl) as T | undefined);
        // 'api' is the global prefix set in app.setup.ts.
        const rawPath = joinPath('api', base, sub);
        routes.push({
          method: RequestMethod[method],
          rawPath,
          path: rawPath.replace(/:[A-Za-z_]+/g, SAMPLE_ID),
          capability: pick<Capability>(CAPABILITY_KEY),
          isPublic: pick<boolean>(IS_PUBLIC_KEY) === true,
          client: pick<'web' | 'extension'>(CLIENT_KIND_KEY) ?? 'web',
        });
      }
    }
  }
  return routes;
}
