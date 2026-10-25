import type { TFunction } from 'i18next';
import { ApiError } from './api';

/** A user-facing message for any error: the code's translation, else a generic one. Never the raw server text. */
export function apiErrorMessage(t: TFunction, error: unknown, overrides: Record<string, string> = {}): string {
  const code = error instanceof ApiError ? error.code : 'UNKNOWN';
  if (overrides[code]) return overrides[code];
  const key = `errors.${code}`;
  return t(key, { defaultValue: t('errors.UNKNOWN') });
}
