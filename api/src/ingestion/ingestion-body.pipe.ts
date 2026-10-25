import { HttpStatus, Injectable, type PipeTransform } from '@nestjs/common';
import type { ZodIssue } from 'zod';
import {
  INGESTION_MAX_BODY_BYTES,
  LOG_EVENT_FIELDS,
  LogEventSchema,
  SUPPORTED_SCHEMA_VERSIONS,
  type LogEvent,
} from '@hares/contract';
import { formatZodError } from '../common/pipes/zod-validation.pipe';
import { IngestionRejectedException } from './ingestion-rejected.exception';

/**
 * Validates a log event against the strict allowlist (WEB-FR-046..049) and maps
 * the failure to the extension error codes:
 *   PAYLOAD_TOO_LARGE          body over the cap
 *   UNKNOWN_FIELD              any field outside the allowlist (prompt text, user_id, ...);
 *                              the answer lists the ACCEPTED field names, never the received ones
 *   UNSUPPORTED_SCHEMA_VERSION schema_version not supported
 *   INVALID_ENUM               an enum value outside the accepted values (listed in the answer)
 *   VALIDATION_ERROR           anything else (missing field, bad UUID, bad date, ...)
 * Nothing the client sent is echoed back.
 */
@Injectable()
export class IngestionBodyPipe implements PipeTransform {
  transform(value: unknown): LogEvent {
    if (Buffer.byteLength(JSON.stringify(value ?? null), 'utf8') > INGESTION_MAX_BODY_BYTES) {
      throw new IngestionRejectedException('PAYLOAD_TOO_LARGE', HttpStatus.PAYLOAD_TOO_LARGE, 'The event is too large.');
    }
    // A well-formed but unsupported schema_version wins over every other error:
    // the extension must know it is talking an older/newer contract.
    const rawVersion = (value as { schema_version?: unknown } | null)?.schema_version;
    if (
      typeof rawVersion === 'number' &&
      Number.isInteger(rawVersion) &&
      rawVersion > 0 &&
      !(SUPPORTED_SCHEMA_VERSIONS as readonly number[]).includes(rawVersion)
    ) {
      throw this.unsupportedVersion();
    }
    const parsed = LogEventSchema.safeParse(value);
    if (parsed.success) {
      return parsed.data;
    }

    const issues = parsed.error.issues;
    if (issues.some((i) => i.code === 'unrecognized_keys')) {
      throw new IngestionRejectedException(
        'UNKNOWN_FIELD',
        HttpStatus.BAD_REQUEST,
        'The event contains a field that is not allowed.',
        { accepted_fields: [...LOG_EVENT_FIELDS] },
      );
    }
    const enumIssues = issues.filter((i): i is ZodIssue & { options: unknown[] } => i.code === 'invalid_enum_value');
    if (enumIssues.length > 0) {
      const details: Record<string, string[]> = {};
      for (const i of enumIssues) details[i.path.join('.')] = ['accepted: ' + i.options.map(String).join(', ')];
      throw new IngestionRejectedException('INVALID_ENUM', HttpStatus.BAD_REQUEST, 'An enum value is not accepted.', details);
    }
    throw new IngestionRejectedException(
      'VALIDATION_ERROR',
      HttpStatus.BAD_REQUEST,
      'Request validation failed',
      formatZodError({ issues }),
    );
  }

  private unsupportedVersion(): IngestionRejectedException {
    return new IngestionRejectedException(
      'UNSUPPORTED_SCHEMA_VERSION',
      HttpStatus.BAD_REQUEST,
      'This schema_version is not supported.',
      { supported_schema_versions: SUPPORTED_SCHEMA_VERSIONS.map(String) },
    );
  }
}
