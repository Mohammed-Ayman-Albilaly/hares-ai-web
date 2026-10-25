import type { ZodType } from 'zod';
import { ZOD_SCHEMA_METADATA } from '../pipes/zod-validation.pipe';

/**
 * Attach a Zod schema to a DTO class so the global `ZodValidationPipe` can
 * validate it. Use on a class whose fields are validated by the pipe.
 */
export function ZodSchema(schema: ZodType): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(ZOD_SCHEMA_METADATA, schema, target);
  };
}
