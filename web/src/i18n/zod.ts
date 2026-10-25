import { z } from 'zod';
import type { TFunction } from 'i18next';

/**
 * The contract schemas carry message KEYS (`password.needs_digit`, ...) or Zod's
 * default English text. Forms translate an issue like this: a known key is
 * translated, anything else becomes a generic message chosen by the issue type,
 * so no English default ever reaches an Arabic screen and no entered value is echoed.
 */
export function zodIssueMessage(t: TFunction, issue: z.ZodIssue): string {
  if (/^[a-z_]+\.[a-z_]+$/.test(issue.message) && t(issue.message, { defaultValue: '' }) !== '') {
    return t(issue.message);
  }
  switch (issue.code) {
    case z.ZodIssueCode.invalid_string:
      return issue.validation === 'email' ? t('validation.email') : t('validation.invalid');
    case z.ZodIssueCode.too_small:
      return issue.minimum === 1 || issue.minimum === 1n ? t('validation.required') : t('validation.tooShort');
    case z.ZodIssueCode.too_big:
      return t('validation.tooLong');
    case z.ZodIssueCode.invalid_type:
      return issue.received === 'undefined' || issue.received === 'null' ? t('validation.required') : t('validation.invalid');
    default:
      return t('validation.invalid');
  }
}

/** Map a ZodError to `{ field: message }` (first issue per field), already translated. */
export function zodFieldErrors(t: TFunction, error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    out[key] ??= zodIssueMessage(t, issue);
  }
  return out;
}
