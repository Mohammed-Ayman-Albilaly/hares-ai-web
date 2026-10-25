import {
  Injectable,
  type ArgumentMetadata,
  type PipeTransform,
} from '@nestjs/common';
import type { ZodType } from 'zod';
import { ValidationException } from '../validation-exception';

/** Metadata key for attaching a Zod schema to a DTO class (for the global pipe). */
export const ZOD_SCHEMA_METADATA = 'hares:zod-schema';

/**
 * Format a Zod error into a code-only field map.
 *
 * Field-level errors are grouped by the field path (root fields use `_`). The
 * messages are the static issue messages from Zod and do not echo the received
 * value, satisfying the "never echo the value / code-only details" rule.
 */
export function formatZodError(error: {
  issues: { path: (string | number)[]; message: string }[];
}): Record<string, string[]> {
  const details: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    (details[key] ??= []).push(issue.message);
  }
  return details;
}

/**
 * Pipe that validates a value against a Zod schema and returns the parsed
 * (typed + coerced) value, throwing a `ValidationException` on failure.
 *
 * Two ways to use it:
 *  - Per-route: `@Body(new ZodValidationPipe(SomeSchema))`.
 *  - Globally (APP_PIPE): pass no schema and decorate the DTO class with
 *    `@ZodSchema(SomeSchema)`; the pipe reads the schema from metadata.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema?: ZodType) {}

  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    const schema =
      this.schema ??
      (metadata.metatype &&
      Reflect.getMetadata(ZOD_SCHEMA_METADATA, metadata.metatype)
        ? (Reflect.getMetadata(ZOD_SCHEMA_METADATA, metadata.metatype) as ZodType)
        : undefined);

    if (!schema) {
      return value;
    }

    const result = schema.safeParse(value);
    if (!result.success) {
      throw new ValidationException(formatZodError(result.error));
    }
    return result.data;
  }
}
