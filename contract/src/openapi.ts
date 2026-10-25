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
  ClientTypeSchema,
  LogActionSchema,
  PlatformSchema,
  PolicyActionSchema,
  RiskLevelSchema,
  RoleSchema,
  RuleKindSchema,
  SchemaVersionSchema,
  UserDecisionSchema,
  UserStatusSchema,
} from './enums';
import { ApiErrorEnvelopeSchema, ErrorEnvelopeSchema } from './error';
import {
  ExtensionLoginRequestSchema,
  ExtensionLoginResponseSchema,
  ExtensionLogoutRequestSchema,
  ExtensionRefreshRequestSchema,
  ExtensionRefreshResponseSchema,
} from './auth';
import { ErrorCodeSchema, ExtensionErrorEnvelopeSchema } from './errors';
import { AuditActionSchema, AuditTargetTypeSchema } from './audit';
import { CapabilitySchema, GrantSchema } from './capabilities';
import {
  CreateDepartmentRequestSchema,
  DeactivateDepartmentRequestSchema,
  DepartmentErrorCodeSchema,
  DepartmentListResponseSchema,
  DepartmentResponseSchema,
  RenameDepartmentRequestSchema,
} from './departments';
import {
  AnalyticsQuerySchema,
  AuditEntryResponseSchema,
  AuditQueryResponseSchema,
  AuditQuerySchema,
  DashboardScopeSchema,
  DashboardSummaryResponseSchema,
  DashboardTimeseriesResponseSchema,
  DepartmentBreakdownSchema,
  TimeseriesPointSchema,
  TopRiskyUsersResponseSchema,
} from './analytics';
import { HealthResponseSchema } from './health';
import {
  CsvExportResponseSchema,
  LogDetailSchema,
  LogErrorCodeSchema,
  LogExportQuerySchema,
  LogListItemSchema,
  LogListResponseSchema,
  LogQuerySchema,
  OwnLogQuerySchema,
} from './logs';
import {
  BundleETagSchema,
  CategoryPolicyEntrySchema,
  CustomRuleListResponseSchema,
  CustomRuleRequestSchema,
  CustomRuleResponseSchema,
  DepartmentPolicyResponseSchema,
  OrgPolicyResponseSchema,
  PolicyCategoryActionRequestSchema,
  PolicyErrorCodeSchema,
  PolicySourceSchema,
  RuleScopeSchema,
} from './policy-admin';
import {
  AdminUserResponseSchema,
  ApproveUserRequestSchema,
  AssignRoleRequestSchema,
  AssignableRoleSchema,
  ChangeDepartmentRequestSchema,
  PendingListQuerySchema,
  ProfileResponseSchema,
  ReactivateUserRequestSchema,
  RejectUserRequestSchema,
  RevokeSystemAdminRequestSchema,
  UserErrorCodeSchema,
  UserListQuerySchema,
  UserListResponseSchema,
  UserStatusUpdateRequestSchema,
} from './users';
import {
  ChangePasswordRequestSchema,
  ForgotPasswordRequestSchema,
  ForgotPasswordResponseSchema,
  PasswordErrorCodeSchema,
  ResetPasswordRequestSchema,
  ThrottleConfigSchema,
} from './password';
import {
  LoginRequestSchema,
  LoginResponseSchema,
  LogoutRequestSchema,
  MeResponseSchema,
  REFRESH_COOKIE_NAME,
  RefreshRequestSchema,
  RefreshResponseSchema,
  RegisterRequestSchema,
  RegisterResponseSchema,
  TokenPairSchema,
  UserPublicSchema,
  WebAuthErrorCodeSchema,
} from './web-auth';
import { CorrelationIdSchema, RequestContextSchema } from './request-context';
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
registry.register('ErrorEnvelope', ErrorEnvelopeSchema);
registry.register('HealthResponse', HealthResponseSchema);
registry.register('CorrelationId', CorrelationIdSchema);
registry.register('RequestContext', RequestContextSchema);
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
registry.register('ClientType', ClientTypeSchema);
registry.register('Capability', CapabilitySchema);
registry.register('Grant', GrantSchema);
registry.register('DepartmentResponse', DepartmentResponseSchema);
registry.register('DepartmentListResponse', DepartmentListResponseSchema);
registry.register('CreateDepartmentRequest', CreateDepartmentRequestSchema);
registry.register('RenameDepartmentRequest', RenameDepartmentRequestSchema);
registry.register('DeactivateDepartmentRequest', DeactivateDepartmentRequestSchema);
registry.register('DepartmentErrorCode', DepartmentErrorCodeSchema);
registry.register('AssignableRole', AssignableRoleSchema);
registry.register('DashboardScope', DashboardScopeSchema);
registry.register('AnalyticsQuery', AnalyticsQuerySchema);
registry.register('DepartmentBreakdown', DepartmentBreakdownSchema);
registry.register('TimeseriesPoint', TimeseriesPointSchema);
registry.register('DashboardSummaryResponse', DashboardSummaryResponseSchema);
registry.register('DashboardTimeseriesResponse', DashboardTimeseriesResponseSchema);
registry.register('TopRiskyUsersResponse', TopRiskyUsersResponseSchema);
registry.register('AuditQuery', AuditQuerySchema);
registry.register('AuditEntryResponse', AuditEntryResponseSchema);
registry.register('AuditQueryResponse', AuditQueryResponseSchema);
registry.register('LogListItem', LogListItemSchema);
registry.register('LogListResponse', LogListResponseSchema);
registry.register('LogDetail', LogDetailSchema);
registry.register('LogQuery', LogQuerySchema);
registry.register('OwnLogQuery', OwnLogQuerySchema);
registry.register('LogExportQuery', LogExportQuerySchema);
registry.register('CsvExportResponse', CsvExportResponseSchema);
registry.register('LogErrorCode', LogErrorCodeSchema);
registry.register('RuleScope', RuleScopeSchema);
registry.register('PolicySource', PolicySourceSchema);
registry.register('CategoryPolicyEntry', CategoryPolicyEntrySchema);
registry.register('OrgPolicyResponse', OrgPolicyResponseSchema);
registry.register('DepartmentPolicyResponse', DepartmentPolicyResponseSchema);
registry.register('PolicyCategoryActionRequest', PolicyCategoryActionRequestSchema);
registry.register('CustomRuleRequest', CustomRuleRequestSchema);
registry.register('CustomRuleResponse', CustomRuleResponseSchema);
registry.register('CustomRuleListResponse', CustomRuleListResponseSchema);
registry.register('BundleETag', BundleETagSchema);
registry.register('PolicyErrorCode', PolicyErrorCodeSchema);
registry.register('AdminUserResponse', AdminUserResponseSchema);
registry.register('UserListQuery', UserListQuerySchema);
registry.register('UserListResponse', UserListResponseSchema);
registry.register('ApproveUserRequest', ApproveUserRequestSchema);
registry.register('RejectUserRequest', RejectUserRequestSchema);
registry.register('UserStatusUpdateRequest', UserStatusUpdateRequestSchema);
registry.register('ReactivateUserRequest', ReactivateUserRequestSchema);
registry.register('AssignRoleRequest', AssignRoleRequestSchema);
registry.register('ChangeDepartmentRequest', ChangeDepartmentRequestSchema);
registry.register('RevokeSystemAdminRequest', RevokeSystemAdminRequestSchema);
registry.register('ProfileResponse', ProfileResponseSchema);
registry.register('UserErrorCode', UserErrorCodeSchema);
registry.register('AuditAction', AuditActionSchema);
registry.register('AuditTargetType', AuditTargetTypeSchema);
registry.register('UserStatus', UserStatusSchema);
registry.register('Role', RoleSchema);
registry.register('WebAuthErrorCode', WebAuthErrorCodeSchema);
registry.register('UserPublic', UserPublicSchema);
registry.register('RegisterRequest', RegisterRequestSchema);
registry.register('RegisterResponse', RegisterResponseSchema);
registry.register('LoginRequest', LoginRequestSchema);
registry.register('LoginResponse', LoginResponseSchema);
registry.register('TokenPair', TokenPairSchema);
registry.register('RefreshRequest', RefreshRequestSchema);
registry.register('RefreshResponse', RefreshResponseSchema);
registry.register('LogoutRequest', LogoutRequestSchema);
registry.register('MeResponse', MeResponseSchema);
registry.register('ForgotPasswordRequest', ForgotPasswordRequestSchema);
registry.register('ForgotPasswordResponse', ForgotPasswordResponseSchema);
registry.register('ResetPasswordRequest', ResetPasswordRequestSchema);
registry.register('ChangePasswordRequest', ChangePasswordRequestSchema);
registry.register('ThrottleConfig', ThrottleConfigSchema);
registry.register('PasswordErrorCode', PasswordErrorCodeSchema);
registry.registerComponent('securitySchemes', 'refreshCookie', {
  type: 'apiKey',
  in: 'cookie',
  name: REFRESH_COOKIE_NAME,
});
registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

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

/** Error response carrying the generic envelope (web endpoints use a broader code set). */
function webError(status: number, description: string, code: string): ResponseConfig {
  return {
    description,
    content: {
      'application/json': {
        schema: ErrorEnvelopeSchema,
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
  method: 'get',
  path: '/health',
  summary: 'API liveness/readiness probe',
  tags: ['health'],
  responses: {
    200: {
      description: 'API is healthy and serving requests.',
      ...jsonBody(HealthResponseSchema),
    },
    503: {
      description: 'API is not ready (e.g. the database is unreachable).',
      content: {
        'application/json': { schema: ErrorEnvelopeSchema },
      },
    },
  },
});

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
    401: errorResponse(
      401,
      'INVALID_CREDENTIALS (wrong email or password), or after a correct password ACCOUNT_NO_ACCESS (PENDING/REJECTED) or ACCOUNT_INACTIVE (DEACTIVATED).',
      'INVALID_CREDENTIALS',
    ),
    429: errorResponse(429, 'Login throttled (progressive delay); see the Retry-After header.', 'RATE_LIMITED'),
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
    401: errorResponse(
      401,
      'INVALID_TOKEN (unknown, expired or web token), TOKEN_REVOKED (family revoked, user not active or token_version changed) or REFRESH_REUSED (replay detected; whole family revoked).',
      'REFRESH_REUSED',
    ),
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
    400: errorResponse(400, 'Missing or invalid refresh token.', 'VALIDATION_ERROR'),
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
    400: errorResponse(
      400,
      'UNKNOWN_FIELD (a field outside the allowlist; the answer lists the accepted fields), INVALID_ENUM (accepted values listed), UNSUPPORTED_SCHEMA_VERSION, EVENT_TIME_OUT_OF_RANGE (more than 5 minutes in the future or older than 90 days) or VALIDATION_ERROR. Nothing the client sent is echoed.',
      'UNKNOWN_FIELD',
    ),
    401: errorResponse(401, 'INVALID_TOKEN, TOKEN_EXPIRED, TOKEN_REVOKED or ACCOUNT_INACTIVE; a web token is refused here.', 'INVALID_TOKEN'),
    403: errorResponse(403, 'DEPARTMENT_INACTIVE: ingestion is blocked for a deactivated department.', 'DEPARTMENT_INACTIVE'),
    413: errorResponse(413, 'The event is larger than 8 KB.', 'PAYLOAD_TOO_LARGE'),
    429: errorResponse(429, 'More than 120 events per minute for this user; see Retry-After.', 'RATE_LIMITED'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/policy/bundle',
  summary: 'Fetch the resolved policy bundle',
  tags: ['policy'],
  security: [{ bearerAuth: [] }],
  request: { headers: z.object({ 'If-None-Match': z.string().optional() }) },
  responses: {
    200: {
      description: 'Current policy bundle with ETag (Cache-Control: private).',
      headers: z.object({ ETag: z.string(), 'Cache-Control': z.string() }),
      ...jsonBody(PolicyBundleResponseSchema),
    },
    304: {
      description: 'Not Modified — version unchanged since the If-None-Match ETag.',
      headers: z.object({ ETag: z.string(), 'Cache-Control': z.string() }),
    },
    401: errorResponse(401, 'Missing or invalid access token.', 'INVALID_TOKEN'),
  },
});

// ---------- Web auth (B4a) ----------

registry.registerPath({
  method: 'post',
  path: '/auth/register',
  summary: 'Self-register a web account (status PENDING)',
  tags: ['auth'],
  request: { body: jsonBody(RegisterRequestSchema) },
  responses: {
    201: { description: 'Account created in PENDING status.', ...jsonBody(RegisterResponseSchema) },
    400: webError(400, 'Missing fields or password policy not met.', 'VALIDATION_ERROR'),
    403: webError(403, 'Request Origin is not allowed.', 'ORIGIN_NOT_ALLOWED'),
    409: webError(409, 'The email is already registered.', 'EMAIL_TAKEN'),
    429: webError(429, 'Too many requests; see the Retry-After header.', 'RATE_LIMITED'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/login',
  summary: 'Web login; sets the HTTP-only refresh cookie',
  tags: ['auth'],
  request: { body: jsonBody(LoginRequestSchema) },
  responses: {
    200: {
      description: 'Authenticated. Set-Cookie carries the refresh token (HttpOnly, SameSite=Strict).',
      ...jsonBody(LoginResponseSchema),
    },
    400: webError(400, 'Email or password missing.', 'VALIDATION_ERROR'),
    401: webError(
      401,
      'INVALID_CREDENTIALS (wrong email or password), or after a correct password ACCOUNT_PENDING, ACCOUNT_REJECTED or ACCOUNT_INACTIVE.',
      'INVALID_CREDENTIALS',
    ),
    403: webError(403, 'Request Origin is not allowed.', 'ORIGIN_NOT_ALLOWED'),
    429: webError(429, 'Login throttled (progressive delay); see the Retry-After header.', 'RATE_LIMITED'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/refresh',
  summary: 'Rotate the web refresh cookie and issue a new access token',
  tags: ['auth'],
  security: [{ refreshCookie: [] }],
  request: { body: jsonBody(RefreshRequestSchema) },
  responses: {
    200: { description: 'Rotated; Set-Cookie carries the new refresh token.', ...jsonBody(RefreshResponseSchema) },
    401: webError(
      401,
      'INVALID_TOKEN (missing, unknown or expired cookie), TOKEN_REVOKED (family revoked) or REFRESH_REUSED (replay detected).',
      'INVALID_TOKEN',
    ),
    403: webError(403, 'Request Origin is not allowed.', 'ORIGIN_NOT_ALLOWED'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/logout',
  summary: 'Revoke the refresh family and clear the cookie',
  tags: ['auth'],
  security: [{ refreshCookie: [] }],
  request: { body: jsonBody(LogoutRequestSchema) },
  responses: {
    204: { description: 'No Content; the cookie is cleared even if it was already invalid.' },
    403: webError(403, 'Request Origin is not allowed.', 'ORIGIN_NOT_ALLOWED'),
  },
});

registry.registerPath({
  method: 'get',
  path: '/auth/me',
  summary: 'Current account',
  tags: ['auth'],
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: 'The authenticated account.', ...jsonBody(MeResponseSchema) },
    401: webError(
      401,
      'INVALID_TOKEN, TOKEN_EXPIRED (call /auth/refresh), TOKEN_REVOKED or ACCOUNT_INACTIVE.',
      'INVALID_TOKEN',
    ),
  },
});

// ---------- Password recovery and change (B4c) ----------

const rateLimited = webError(429, 'Too many requests; see the Retry-After header.', 'RATE_LIMITED');

registry.registerPath({
  method: 'post',
  path: '/auth/forgot-password',
  summary: 'Request a password-reset email',
  description: 'Always 202, whether or not the email is registered (decision 29). Only ACTIVE accounts get an email.',
  tags: ['auth'],
  request: { body: jsonBody(ForgotPasswordRequestSchema) },
  responses: {
    202: { description: 'Accepted.', ...jsonBody(ForgotPasswordResponseSchema) },
    400: webError(400, 'Missing or invalid email.', 'VALIDATION_ERROR'),
    403: webError(403, 'Request Origin is not allowed.', 'ORIGIN_NOT_ALLOWED'),
    429: rateLimited,
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/reset-password',
  summary: 'Set a new password with a single-use reset token',
  tags: ['auth'],
  request: { body: jsonBody(ResetPasswordRequestSchema) },
  responses: {
    204: { description: 'Password changed; every existing session is revoked.' },
    400: webError(400, 'RESET_TOKEN_INVALID (unknown, used or expired) or VALIDATION_ERROR (password policy).', 'RESET_TOKEN_INVALID'),
    403: webError(403, 'Request Origin is not allowed.', 'ORIGIN_NOT_ALLOWED'),
    429: rateLimited,
  },
});

registry.registerPath({
  method: 'post',
  path: '/auth/change-password',
  summary: 'Change the current password',
  tags: ['auth'],
  security: [{ bearerAuth: [] }],
  request: { body: jsonBody(ChangePasswordRequestSchema) },
  responses: {
    200: {
      description: 'Changed. All other sessions are revoked; a new session (body + refresh cookie) is issued.',
      ...jsonBody(LoginResponseSchema),
    },
    400: webError(400, 'INVALID_CURRENT_PASSWORD or VALIDATION_ERROR (password policy).', 'INVALID_CURRENT_PASSWORD'),
    401: webError(401, 'Missing, expired or revoked access token.', 'INVALID_TOKEN'),
    403: webError(403, 'Request Origin is not allowed.', 'ORIGIN_NOT_ALLOWED'),
    429: webError(429, 'Too many wrong current passwords (progressive delay) or request window; see Retry-After.', 'RATE_LIMITED'),
  },
});

// ---------- Departments (B5a, System Admin only) ----------

const forbiddenRole = webError(403, 'The role of the caller may not use this endpoint (capability matrix).', 'FORBIDDEN');
const unauthenticated = webError(401, 'Missing, expired or revoked access token.', 'INVALID_TOKEN');
const idParam = z.object({ id: z.string().uuid() });

registry.registerPath({
  method: 'get',
  path: '/admin/departments',
  summary: 'List departments with member counts',
  tags: ['departments'],
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: 'All departments.', ...jsonBody(DepartmentListResponseSchema) },
    401: unauthenticated,
    403: forbiddenRole,
  },
});

registry.registerPath({
  method: 'post',
  path: '/admin/departments',
  summary: 'Create a department',
  tags: ['departments'],
  security: [{ bearerAuth: [] }],
  request: { body: jsonBody(CreateDepartmentRequestSchema) },
  responses: {
    201: { description: 'Created.', ...jsonBody(DepartmentResponseSchema) },
    400: webError(400, 'Invalid name.', 'VALIDATION_ERROR'),
    401: unauthenticated,
    403: forbiddenRole,
    409: webError(409, 'Another department has this name (case-insensitive).', 'DEPARTMENT_NAME_TAKEN'),
  },
});

registry.registerPath({
  method: 'patch',
  path: '/admin/departments/{id}',
  summary: 'Rename a department',
  tags: ['departments'],
  security: [{ bearerAuth: [] }],
  request: { params: idParam, body: jsonBody(RenameDepartmentRequestSchema) },
  responses: {
    200: { description: 'Renamed.', ...jsonBody(DepartmentResponseSchema) },
    400: webError(400, 'Invalid id or name.', 'VALIDATION_ERROR'),
    401: unauthenticated,
    403: forbiddenRole,
    404: webError(404, 'Unknown department.', 'DEPARTMENT_NOT_FOUND'),
    409: webError(409, 'Another department has this name.', 'DEPARTMENT_NAME_TAKEN'),
  },
});

registry.registerPath({
  method: 'post',
  path: '/admin/departments/{id}/deactivate',
  summary: 'Deactivate a department (blocks log ingestion for its users)',
  tags: ['departments'],
  security: [{ bearerAuth: [] }],
  request: { params: idParam, body: jsonBody(DeactivateDepartmentRequestSchema) },
  responses: {
    200: { description: 'Deactivated.', ...jsonBody(DepartmentResponseSchema) },
    400: webError(400, 'Invalid id.', 'VALIDATION_ERROR'),
    401: unauthenticated,
    403: forbiddenRole,
    404: webError(404, 'Unknown department.', 'DEPARTMENT_NOT_FOUND'),
    409: webError(409, 'Already inactive.', 'DEPARTMENT_INACTIVE'),
  },
});

// ---------- Users and profile (B5b) ----------

const userId = z.object({ id: z.string().uuid() });
const userErrors = {
  400: webError(400, 'Invalid id or body.', 'VALIDATION_ERROR'),
  401: unauthenticated,
  403: webError(403, 'Role not allowed, target out of scope, or CANNOT_MODIFY_SELF.', 'FORBIDDEN'),
  404: webError(404, 'USER_NOT_FOUND or DEPARTMENT_NOT_FOUND.', 'USER_NOT_FOUND'),
  409: webError(409, 'INVALID_USER_STATE (action does not fit the current status/role) or DEPARTMENT_INACTIVE.', 'INVALID_USER_STATE'),
};
const adminOk = (description: string) => ({ description, ...jsonBody(AdminUserResponseSchema) });

registry.registerPath({
  method: 'get',
  path: '/profile',
  summary: 'Own profile (name, email, department, role)',
  tags: ['users'],
  security: [{ bearerAuth: [] }],
  responses: { 200: { description: 'The caller.', ...jsonBody(ProfileResponseSchema) }, 401: unauthenticated },
});

registry.registerPath({
  method: 'get',
  path: '/admin/users',
  summary: 'List users (System Admin: all; Department Admin: own department), paginated',
  tags: ['users'],
  security: [{ bearerAuth: [] }],
  request: { query: UserListQuerySchema },
  responses: {
    200: { description: 'A page of users.', ...jsonBody(UserListResponseSchema) },
    400: userErrors[400],
    401: unauthenticated,
    403: userErrors[403],
  },
});

registry.registerPath({
  method: 'get',
  path: '/admin/users/pending',
  summary: 'Pending approvals (System Admin only), oldest first',
  tags: ['users'],
  security: [{ bearerAuth: [] }],
  request: { query: PendingListQuerySchema },
  responses: {
    200: { description: 'A page of PENDING accounts.', ...jsonBody(UserListResponseSchema) },
    400: userErrors[400],
    401: unauthenticated,
    403: userErrors[403],
  },
});

registry.registerPath({
  method: 'post',
  path: '/admin/users/{id}/approve',
  summary: 'Approve a PENDING user with department and role (one UPDATE)',
  tags: ['users'],
  security: [{ bearerAuth: [] }],
  request: { params: userId, body: jsonBody(ApproveUserRequestSchema) },
  responses: { 200: adminOk('Now ACTIVE.'), ...userErrors },
});

registry.registerPath({
  method: 'post',
  path: '/admin/users/{id}/reject',
  summary: 'Reject a PENDING user (terminal)',
  tags: ['users'],
  security: [{ bearerAuth: [] }],
  request: { params: userId, body: jsonBody(RejectUserRequestSchema) },
  responses: { 200: adminOk('Now REJECTED.'), ...userErrors },
});

registry.registerPath({
  method: 'post',
  path: '/admin/users/{id}/reopen',
  summary: 'Re-open a REJECTED user to PENDING',
  tags: ['users'],
  security: [{ bearerAuth: [] }],
  request: { params: userId, body: jsonBody(UserStatusUpdateRequestSchema) },
  responses: { 200: adminOk('Now PENDING.'), ...userErrors },
});

registry.registerPath({
  method: 'post',
  path: '/admin/users/{id}/deactivate',
  summary: 'Deactivate a user; revokes all their tokens at once',
  tags: ['users'],
  security: [{ bearerAuth: [] }],
  request: { params: userId, body: jsonBody(UserStatusUpdateRequestSchema) },
  responses: { 200: adminOk('Now DEACTIVATED.'), ...userErrors },
});

registry.registerPath({
  method: 'post',
  path: '/admin/users/{id}/reactivate',
  summary: 'Reactivate a DEACTIVATED user (System Admin)',
  tags: ['users'],
  security: [{ bearerAuth: [] }],
  request: { params: userId, body: jsonBody(ReactivateUserRequestSchema) },
  responses: { 200: adminOk('Now ACTIVE.'), ...userErrors },
});

registry.registerPath({
  method: 'patch',
  path: '/admin/users/{id}/role',
  summary: 'Assign DEPARTMENT_ADMIN or USER',
  tags: ['users'],
  security: [{ bearerAuth: [] }],
  request: { params: userId, body: jsonBody(AssignRoleRequestSchema) },
  responses: { 200: adminOk('Role updated.'), ...userErrors },
});

registry.registerPath({
  method: 'patch',
  path: '/admin/users/{id}/department',
  summary: 'Move a user to another ACTIVE department',
  tags: ['users'],
  security: [{ bearerAuth: [] }],
  request: { params: userId, body: jsonBody(ChangeDepartmentRequestSchema) },
  responses: { 200: adminOk('Department updated.'), ...userErrors },
});

registry.registerPath({
  method: 'post',
  path: '/admin/users/{id}/grant-system-admin',
  summary: 'Grant SYSTEM_ADMIN to an ACTIVE user',
  tags: ['users'],
  security: [{ bearerAuth: [] }],
  request: { params: userId, body: jsonBody(UserStatusUpdateRequestSchema) },
  responses: { 200: adminOk('Now SYSTEM_ADMIN (no department).'), ...userErrors },
});

registry.registerPath({
  method: 'post',
  path: '/admin/users/{id}/revoke-system-admin',
  summary: 'Revoke SYSTEM_ADMIN, choosing the new role and an ACTIVE department',
  tags: ['users'],
  security: [{ bearerAuth: [] }],
  request: { params: userId, body: jsonBody(RevokeSystemAdminRequestSchema) },
  responses: { 200: adminOk('Role revoked.'), ...userErrors },
});

// ---------- Policy and custom rules (B6) ----------

const categoryParam = z.object({ category: CategoryCodeSchema });
const deptCategoryParams = z.object({ id: z.string().uuid(), category: CategoryCodeSchema });
const policyErrors = {
  401: unauthenticated,
  403: forbiddenRole,
  404: webError(404, 'DEPARTMENT_NOT_FOUND or RULE_NOT_FOUND.', 'DEPARTMENT_NOT_FOUND'),
};

registry.registerPath({
  method: 'get',
  path: '/admin/policy/org',
  summary: 'Organisation policy: one effective entry per category, with its source',
  tags: ['policy'],
  security: [{ bearerAuth: [] }],
  responses: { 200: { description: 'Org policy and version.', ...jsonBody(OrgPolicyResponseSchema) }, 401: unauthenticated, 403: forbiddenRole },
});

registry.registerPath({
  method: 'put',
  path: '/admin/policy/org/{category}',
  summary: 'Set the organisation action and enabled flag for a category (System Admin)',
  tags: ['policy'],
  security: [{ bearerAuth: [] }],
  request: { params: categoryParam, body: jsonBody(PolicyCategoryActionRequestSchema) },
  responses: {
    200: { description: 'Updated; a changed value bumps the bundle version.', ...jsonBody(OrgPolicyResponseSchema) },
    400: webError(400, 'Invalid category or body.', 'VALIDATION_ERROR'),
    401: unauthenticated,
    403: forbiddenRole,
  },
});

registry.registerPath({
  method: 'get',
  path: '/admin/policy/departments/{id}',
  summary: 'Effective policy of a department (Department Admin: own department only)',
  tags: ['policy'],
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: { 200: { description: 'Effective policy.', ...jsonBody(DepartmentPolicyResponseSchema) }, ...policyErrors },
});

registry.registerPath({
  method: 'put',
  path: '/admin/policy/departments/{id}/{category}',
  summary: 'Set a department override for a category (System Admin)',
  tags: ['policy'],
  security: [{ bearerAuth: [] }],
  request: { params: deptCategoryParams, body: jsonBody(PolicyCategoryActionRequestSchema) },
  responses: {
    200: { description: 'Updated.', ...jsonBody(DepartmentPolicyResponseSchema) },
    400: webError(400, 'Invalid id, category or body.', 'VALIDATION_ERROR'),
    ...policyErrors,
  },
});

registry.registerPath({
  method: 'delete',
  path: '/admin/policy/departments/{id}/{category}',
  summary: 'Remove a department override (back to the organisation value)',
  tags: ['policy'],
  security: [{ bearerAuth: [] }],
  request: { params: deptCategoryParams },
  responses: { 200: { description: 'Updated.', ...jsonBody(DepartmentPolicyResponseSchema) }, ...policyErrors },
});

registry.registerPath({
  method: 'get',
  path: '/admin/rules',
  summary: 'Custom rules (System Admin: all; Department Admin: those applying to their department)',
  tags: ['policy'],
  security: [{ bearerAuth: [] }],
  responses: { 200: { description: 'Rules and version.', ...jsonBody(CustomRuleListResponseSchema) }, 401: unauthenticated, 403: forbiddenRole },
});

registry.registerPath({
  method: 'post',
  path: '/admin/rules',
  summary: 'Create a custom rule (rule and department links in one transaction)',
  tags: ['policy'],
  security: [{ bearerAuth: [] }],
  request: { body: jsonBody(CustomRuleRequestSchema) },
  responses: {
    201: { description: 'Created.', ...jsonBody(CustomRuleResponseSchema) },
    400: webError(400, 'Invalid rule; an unsafe PATTERN gives details.definition = rule.pattern_* .', 'VALIDATION_ERROR'),
    401: unauthenticated,
    403: forbiddenRole,
    404: webError(404, 'A listed department does not exist.', 'DEPARTMENT_NOT_FOUND'),
  },
});

registry.registerPath({
  method: 'put',
  path: '/admin/rules/{id}',
  summary: 'Edit a custom rule, including enabled (full replace)',
  tags: ['policy'],
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ id: z.string().uuid() }), body: jsonBody(CustomRuleRequestSchema) },
  responses: {
    200: { description: 'Updated; an unchanged rule does not bump the version.', ...jsonBody(CustomRuleResponseSchema) },
    400: webError(400, 'Invalid id or rule.', 'VALIDATION_ERROR'),
    ...policyErrors,
  },
});

// ---------- Log review and export (B7b) ----------

const logErrors = {
  400: webError(400, 'Unknown parameter, bad enum, reversed date range, page_size over 100, or INVALID_CURSOR.', 'VALIDATION_ERROR'),
  401: unauthenticated,
  403: forbiddenRole,
};

registry.registerPath({
  method: 'get',
  path: '/logs/mine',
  summary: 'Own activity log (any signed-in role); action=BLOCKED gives "Blocked Messages"',
  tags: ['logs'],
  security: [{ bearerAuth: [] }],
  request: { query: OwnLogQuerySchema },
  responses: { 200: { description: 'A page, newest first.', ...jsonBody(LogListResponseSchema) }, ...logErrors },
});

registry.registerPath({
  method: 'get',
  path: '/admin/logs',
  summary: 'Activity logs (System Admin: organisation; Department Admin: own department), keyset-paginated',
  tags: ['logs'],
  security: [{ bearerAuth: [] }],
  request: { query: LogQuerySchema },
  responses: { 200: { description: 'A page, newest first.', ...jsonBody(LogListResponseSchema) }, ...logErrors },
});

registry.registerPath({
  method: 'get',
  path: '/admin/logs/export',
  summary: 'CSV export of the filtered logs (administrators only), streamed in chunks, at most 100000 rows',
  tags: ['logs'],
  security: [{ bearerAuth: [] }],
  request: { query: LogExportQuerySchema },
  responses: {
    200: {
      description:
        'UTF-8 CSV with a byte order mark; columns: log_id, event_time, user_name, user_email, department, platform, risk_level, action, user_decision, categories, classification_source, rule_id. Cells starting with = + - @ tab or CR are prefixed with a quote.',
      headers: z.object({ 'Content-Disposition': z.string() }),
      content: { 'text/csv': { schema: z.string() } },
    },
    ...logErrors,
  },
});

registry.registerPath({
  method: 'get',
  path: '/admin/logs/{log_id}',
  summary: 'One log (same scope as the list; outside the scope it is 404)',
  tags: ['logs'],
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ log_id: z.string().uuid() }) },
  responses: {
    200: { description: 'The log.', ...jsonBody(LogDetailSchema) },
    ...logErrors,
    404: webError(404, 'LOG_NOT_FOUND (also for a log outside the caller scope).', 'LOG_NOT_FOUND'),
  },
});

// ---------- Dashboards and audit trail (B8) ----------

const dashboardErrors = {
  400: webError(400, 'Bad day, reversed or over-long range (max 366 days), unknown parameter, or department_id missing for a System Admin on the department dashboard.', 'VALIDATION_ERROR'),
  401: unauthenticated,
  403: forbiddenRole,
  404: webError(404, 'Unknown department.', 'DEPARTMENT_NOT_FOUND'),
};
const dashboards: Array<[string, string, string]> = [
  ['mine', 'OWN: the caller own events (live log rows, last 90 days), any role', 'OWN_DASHBOARD_VIEW'],
  ['department', 'DEPARTMENT: counters of one department (Department Admin: own; System Admin: ?department_id=)', 'DEPT_DASHBOARD_VIEW'],
  ['org', 'ORG: counters of the whole organisation with the per-department breakdown (System Admin)', 'ORG_DASHBOARD_VIEW'],
];
for (const [name, description] of dashboards) {
  registry.registerPath({
    method: 'get',
    path: `/dashboard/${name}/summary`,
    summary: `Dashboard summary - ${description}`,
    tags: ['dashboard'],
    security: [{ bearerAuth: [] }],
    request: { query: AnalyticsQuerySchema },
    responses: { 200: { description: 'Totals, platforms, top categories.', ...jsonBody(DashboardSummaryResponseSchema) }, ...dashboardErrors },
  });
  registry.registerPath({
    method: 'get',
    path: `/dashboard/${name}/timeseries`,
    summary: `Dashboard risk trend - ${description}`,
    tags: ['dashboard'],
    security: [{ bearerAuth: [] }],
    request: { query: AnalyticsQuerySchema },
    responses: { 200: { description: 'One zero-filled point per UTC day.', ...jsonBody(DashboardTimeseriesResponseSchema) }, ...dashboardErrors },
  });
}

registry.registerPath({
  method: 'get',
  path: '/dashboard/department/top-users',
  summary: 'Top risky users of a department by HIGH-risk events (Department Admin: own department; System Admin: ?department_id=). Live rows, last 90 days at most.',
  tags: ['dashboard'],
  security: [{ bearerAuth: [] }],
  request: { query: AnalyticsQuerySchema },
  responses: { 200: { description: 'Up to 5 users, metadata only.', ...jsonBody(TopRiskyUsersResponseSchema) }, ...dashboardErrors },
});

registry.registerPath({
  method: 'get',
  path: '/admin/audit',
  summary: 'Admin audit trail (System Admin only, read-only), newest first, keyset-paginated',
  tags: ['audit'],
  security: [{ bearerAuth: [] }],
  request: { query: AuditQuerySchema },
  responses: {
    200: { description: 'A page of audit entries.', ...jsonBody(AuditQueryResponseSchema) },
    400: webError(400, 'Unknown parameter, bad enum, reversed range, page_size over 100, or INVALID_CURSOR.', 'VALIDATION_ERROR'),
    401: unauthenticated,
    403: forbiddenRole,
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
    servers: [{ url: 'http://localhost:3000/api' }],
    tags: [
      { name: 'dashboard', description: 'Role-scoped dashboard aggregates.' },
      { name: 'audit', description: 'Admin audit trail (read-only).' },
      { name: 'logs', description: 'Activity log review and CSV export.' },
      { name: 'policy', description: 'Policy, custom rules and the bundle.' },
      { name: 'users', description: 'User lifecycle and profile.' },
      { name: 'departments', description: 'Department management (System Admin).' },
      { name: 'auth', description: 'Web registration, login, refresh and logout.' },
      { name: 'extension', description: 'Extension authentication and log ingestion.' },
      { name: 'policy', description: 'Policy bundle delivery to the extension.' },
      { name: 'health', description: 'API liveness/readiness probe.' },
    ],
  });
}
