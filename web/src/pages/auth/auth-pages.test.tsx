import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, json, loginResponse, mockFetch, renderRoute, useArabic } from '@/test/utils';

beforeEach(async () => {
  await useArabic();
});
afterEach(() => vi.unstubAllGlobals());

const anonymous = { 'POST /api/auth/refresh': () => envelope(401, 'INVALID_TOKEN') };

describe('route guards', () => {
  it('sends an anonymous visitor from a private page to login', async () => {
    mockFetch(anonymous);
    const { router } = renderRoute('/admin/dashboard');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });

  it('shows 403 when a USER opens an admin page', async () => {
    mockFetch({ 'POST /api/auth/refresh': () => json(loginResponse('USER')) });
    renderRoute('/admin/dashboard');
    expect(await screen.findByText('لا تملك صلاحية لهذه الصفحة')).toBeTruthy();
  });

  it('sends a signed-in user away from the login page to their home', async () => {
    mockFetch({ 'POST /api/auth/refresh': () => json(loginResponse('SYSTEM_ADMIN')) });
    const { router } = renderRoute('/login');
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/dashboard'));
  });
});

describe('login page', () => {
  it('validates before calling the server', async () => {
    const m = mockFetch(anonymous);
    renderRoute('/login');
    await userEvent.click(await screen.findByRole('button', { name: /تسجيل الدخول/ }));
    expect((await screen.findAllByRole('alert')).length).toBeGreaterThan(0);
    expect(m.count('POST /api/auth/login')).toBe(0);
  });

  it('signs in and lands on the role home', async () => {
    mockFetch({ ...anonymous, 'POST /api/auth/login': () => json(loginResponse('DEPARTMENT_ADMIN')) });
    const { router } = renderRoute('/login');
    await userEvent.type(await screen.findByLabelText(/البريد/), 'layla@example.test');
    await userEvent.type(screen.getByLabelText(/^كلمة المرور$/), 'Secret#Pass1');
    await userEvent.click(screen.getByRole('button', { name: /تسجيل الدخول/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
  });

  it('shows a wrong-credentials message from the API error code', async () => {
    mockFetch({ ...anonymous, 'POST /api/auth/login': () => envelope(401, 'INVALID_CREDENTIALS') });
    renderRoute('/login');
    await userEvent.type(await screen.findByLabelText(/البريد/), 'layla@example.test');
    await userEvent.type(screen.getByLabelText(/^كلمة المرور$/), 'Secret#Pass1');
    await userEvent.click(screen.getByRole('button', { name: /تسجيل الدخول/ }));
    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('has no automatic accessibility violations', async () => {
    mockFetch(anonymous);
    const { container } = renderRoute('/login');
    await screen.findByLabelText(/البريد/);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('other public pages are accessible', () => {
  it.each(['/register', '/forgot-password', '/'])('%s', async (path) => {
    mockFetch(anonymous);
    const { container } = renderRoute(path);
    await waitFor(() => expect(container.querySelector('h1')).toBeTruthy());
    expect(await axe(container)).toHaveNoViolations();
  });
});
