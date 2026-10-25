import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { RouterProvider } from 'react-router';
import { vi } from 'vitest';
import { AuthProvider } from '@/auth/AuthProvider';
import { Session } from '@/auth/session';
import i18n from '@/i18n';
import { createTestRouter } from '@/routes/router';

export type Handler = (req: { url: string; method: string; body: unknown; headers: Headers }) => Response | Promise<Response>;

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

export const empty = (status = 204): Response => new Response(null, { status });

export const envelope = (status: number, code: string, details?: Record<string, string[]>): Response =>
  json({ status, code, message: code, path: '/', timestamp: new Date().toISOString(), request_id: 'test', ...(details ? { details } : {}) }, status);

/** Replace global fetch with routes keyed `METHOD /api/path`. Unknown routes fail the test loudly. */
export function mockFetch(routes: Record<string, Handler>) {
  const calls: { key: string; body: unknown }[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init?.method ?? 'GET').toUpperCase();
    const path = url.split('?')[0];
    const key = `${method} ${path}`;
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ key, body });
    const h = routes[key];
    if (!h) throw new Error(`Unexpected request: ${key}`);
    return h({ url, method, body, headers: new Headers(init?.headers) });
  });
  vi.stubGlobal('fetch', fn);
  return { fn, calls, count: (key: string) => calls.filter((c) => c.key === key).length };
}

export const loginResponse = (role: 'SYSTEM_ADMIN' | 'DEPARTMENT_ADMIN' | 'USER' = 'USER', expires = 900) => ({
  access_token: 'access-token',
  token_type: 'Bearer',
  expires_in: expires,
  user: {
    id: '11111111-1111-4111-8111-111111111111',
    full_name: 'Layla Test',
    email: 'layla@example.test',
    status: 'ACTIVE',
    role,
    department_id: role === 'SYSTEM_ADMIN' ? null : '22222222-2222-4222-8222-222222222222',
  },
});

/** Render the real route table at `path` with a fresh session and query client. */
export function renderRoute(path: string, session = new Session()) {
  const router = createTestRouter([path]);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider session={session}>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>,
  );
  return { ...utils, router, session };
}

export async function useArabic() {
  await i18n.changeLanguage('ar');
}
