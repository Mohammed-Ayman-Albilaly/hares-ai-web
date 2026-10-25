import type { QueryClient } from '@tanstack/react-query';

/**
 * After any administrator change: reload what it can affect. Users and
 * departments reference each other (names, member counts), dashboards count
 * them, and every change adds an audit entry. Stale data on a screen the admin
 * opens next would look like the change did not happen.
 */
export function invalidateAdmin(qc: QueryClient): Promise<unknown> {
  return Promise.all(['users', 'pending', 'departments', 'audit', 'dashboard', 'policy', 'rules'].map((k) => qc.invalidateQueries({ queryKey: [k] })));
}
