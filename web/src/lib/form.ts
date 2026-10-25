import type { FieldErrors, FieldValues, Resolver } from 'react-hook-form';
import type { TFunction } from 'i18next';
import type { ZodTypeAny, z } from 'zod';
import { zodIssueMessage } from '@/i18n/zod';

/**
 * react-hook-form resolver for a contract Zod schema. The SAME schema runs on
 * the server, so the rules can never drift; messages are translated here (see
 * zodIssueMessage) and never echo what the user typed.
 *
 * `t` is read at validation time, so a language switch applies to the next
 * validation without rebuilding the form.
 */
export function zodResolver<S extends ZodTypeAny>(schema: S, getT: () => TFunction): Resolver<z.infer<S> & FieldValues> {
  return async (values) => {
    const result = schema.safeParse(values);
    if (result.success) return { values: result.data, errors: {} };

    const t = getT();
    const errors: Record<string, unknown> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.length > 0 ? issue.path : ['root'];
      let node = errors;
      path.slice(0, -1).forEach((p) => {
        node = (node[String(p)] ??= {}) as Record<string, unknown>;
      });
      const last = String(path[path.length - 1]);
      node[last] ??= { type: issue.code, message: zodIssueMessage(t, issue) };
    }
    return { values: {}, errors: errors as FieldErrors<z.infer<S> & FieldValues> };
  };
}
