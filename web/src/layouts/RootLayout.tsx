import { Outlet } from 'react-router';
import { RouteAnnouncer } from '@/components/RouteAnnouncer';

/** Wraps every route so a client-side navigation is announced (see RouteAnnouncer). */
export function RootLayout() {
  return (
    <>
      <RouteAnnouncer />
      <Outlet />
    </>
  );
}
