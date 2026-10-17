import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import type { ResponseConfig } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);
import {
  CategoryCodeSchema,
  ClassificationSourceSchema,
  LogActionSchema,
  PlatformSchema,
  PolicyActionSchema,
  RiskLevelSchema,
  RuleKindSchema,
  SchemaVersionSchema,
  UserDecisionSchema,
} from './enums';
import { ApiErrorEnvelopeSchema } from './error';
import {
  ExtensionLoginRequestSchema,
  ExtensionLoginResponseSchema,
  ExtensionLogoutRequestSchema,
  ExtensionRefreshRequestSchema,
  ExtensionRefreshResponseSchema,
} from './auth';
import { ErrorCodeSchema, ExtensionErrorEnvelopeSchema } from './errors';
import { LogEventSchema, LogIngestionResponseSchema } from './ingestion';
import {
  PolicyBundleResponseSchema,
  PolicyBundleVersionSchema,
  PolicyEntrySchema,
  PolicyRuleSchema,
  ResolvedPolicySchema,
} from './policy';

const registry = new OpenAPIRegistry();

// ---------- Reusable component schemas (from contract/src) ----------
registry.register('CategoryCode', CategoryCodeSchema);
registry.register('ClassificationSource', ClassificationSourceSchema);
registry.register('LogAction', LogActionSchema);
registry.register('Platform', PlatformSchema);
registry.register('PolicyAction', PolicyActionSchema);
registry.register('RiskLevel', RiskLevelSchema);
registry.register('RuleKind', RuleKindSchema);
registry.register('SchemaVersion', SchemaVersionSchema);
registry.register('UserDecision', UserDecisionSchema);
registry.register('ErrorCode', ErrorCodeSchema);
registry.register('ApiErrorEnvelope', ApiErrorEnvelopeSchema);
registry.register('ExtensionErrorEnvelope', ExtensionErrorEnvelopeSchema);
registry.register('ExtensionLoginRequest', ExtensionLoginRequestSchema);
registry.register('ExtensionLoginResponse', ExtensionLoginResponseSchema);
registry.register('ExtensionRefreshRequest', ExtensionRefreshRequestSchema);
registry.register('ExtensionRefreshResponse', ExtensionRefreshResponseSchema);
registry.register('ExtensionLogoutRequest', ExtensionLogoutRequestSchema);
registry.register('PolicyEntry', PolicyEntrySchema);
registry.register('ResolvedPolicy', ResolvedPolicySchema);
registry.register('PolicyRule', PolicyRuleSchema);
registry.register('PolicyBundleVersion', PolicyBundleVersionSchema);
registry.register('PolicyBundleResponse', PolicyBundleResponseSchema);
registry.register('LogEvent', LogEventSchema);
registry.register('LogIngestionResponse', LogIngestionResponseSchema);
registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

// ---------- Paths ----------
// ---------- Helpers ----------

/** Standard JSON error response body carrying the extension error envelope. */
function errorResponse(status: number, description: string, code: string): ResponseConfig {
  return {
    description,
    content: {
      'application/json': {
        schema: ExtensionErrorEnvelopeSchema,
        example: {
          status,
          code,
          message: description,
          path: '',
          timestamp: '2026-01-01T00:00:00Z',
          request_id: '00000000-0000-0000-0000-000000000000',
        },
      },
    },
  };
}

function jsonBody(schema: z.ZodTypeAny) {
  return {
    content: {
      'application/json': { schema },
    },
  };
}

// ---------- Paths ----------

registry.registerPath({
  method: 'post',
  path: '/extension/login',
  summary: 'Extension login',
  tags: ['extension'],
  request: {
    body: jsonBody(ExtensionLoginRequestSchema),
  },
  responses: {
    200: {
      description: 'Authentication succeeded; returns access and refresh tokens.',
      ...jsonBody(ExtensionLoginResponseSchema),
    },
    400: errorResponse(400, 'Missing or invalid email/password.', 'VALIDATION_ERROR'),
    401: errorResponse(401, 'Wrong credentials or account not active.', 'INVALID_CREDENTIALS'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/extension/refresh',
  summary: 'Rotate a refresh token',
  tags: ['extension'],
  request: {
    body: jsonBody(ExtensionRefreshRequestSchema),
  },
  responses: {
    200: {
      description: 'Tokens rotated; returns the new access and refresh token pair.',
      ...jsonBody(ExtensionRefreshResponseSchema),
    },
    400: errorResponse(400, 'Missing or invalid refresh token.', 'VALIDATION_ERROR'),
    401: errorResponse(401, 'Refresh token expired, revoked or replayed.', 'REFRESH_REUSED'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/extension/logout',
  summary: 'Revoke a refresh token family',
  tags: ['extension'],
  request: {
    body: jsonBody(ExtensionLogoutRequestSchema),
  },
  responses: {
    204: {
      description: 'No Content; the refresh token family has been revoked.',
    },
    401: errorResponse(401, 'Invalid or already-revoked refresh token.', 'INVALID_TOKEN'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/logs',
  summary: 'Ingest an activity log event',
  tags: ['extension'],
  security: [{ bearerAuth: [] }],
  request: {
    body: jsonBody(LogEventSchema),
  },
  responses: {
    200: {
      description: 'Idempotent acknowledgement for a duplicate log_id.',
      ...jsonBody(LogIngestionResponseSchema),
    },
    201: {
      description: 'Event accepted and stored.',
      ...jsonBody(LogIngestionResponseSchema),
    },
    400: errorResponse(400, 'Event failed the strict allowlist or enum checks.', 'VALIDATION_ERROR'),
    401: errorResponse(401, 'Missing or invalid access token.', 'INVALID_TOKEN'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/policy/bundle',
  summary: 'Fetch the resolved policy bundle',
  tags: ['policy'],
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Current policy bundle with ETag (Cache-Control: private).',
      ...jsonBody(PolicyBundleResponseSchema),
    },
    304: {
      description: 'Not Modified — version unchanged since the If-None-Match ETag.',
    },
    401: errorResponse(401, 'Missing or invalid access token.', 'INVALID_TOKEN'),
  },
});

/** Build the OpenAPI 3.1 document from the registered components and paths. */
export function buildOpenApiDocument() {
  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Hares AI Web API',
      version: '1.0.0',
      description: 'API contract for the Hares AI Web extension and web application (batch B1).',
    },
    servers: [{ url: 'http://localhost:3000' }],
    tags: [
      { name: 'extension', description: 'Extension authentication and log ingestion.' },
      { name: 'policy', description: 'Policy bundle delivery to the extension.' },
    ],
  });
}
