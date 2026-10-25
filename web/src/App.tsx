import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { RouterProvider } from 'react-router';
import { AuthProvider } from '@/auth/AuthProvider';
import { session } from '@/auth/session';
import { ApiError } from '@/lib/api';
import { createAppRouter } from '@/routes/router';

/** Server state: don't retry client errors (4xx), retry network blips and 5xx once. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 1,
      },
    },
  });
}

export function App() {
  const queryClient = useMemo(createQueryClient, []);
  const router = useMemo(() => createAppRouter(), []);
  // Never show one user's cached data to the next person on this browser.
  useEffect(
    () =>
      session.subscribe(() => {
        if (session.getSnapshot().status === 'anonymous') queryClient.clear();
      }),
    [queryClient],
  );
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
