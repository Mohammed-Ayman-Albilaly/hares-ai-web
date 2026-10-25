import { describe, expect, it } from 'vitest';
import { buildOpenApiDocument } from './openapi';

describe('openapi document', () => {
  const document = buildOpenApiDocument();

  it('is an OpenAPI 3.1 document with metadata', () => {
    expect(document.openapi).toBe('3.1.0');
    expect(document.info.title).toBe('Hares AI Web API');
  });

  it('exposes the documented extension and policy endpoints', () => {
    expect(document.paths?.['/extension/login']?.post).toBeDefined();
    expect(document.paths?.['/extension/refresh']?.post).toBeDefined();
    expect(document.paths?.['/extension/logout']?.post).toBeDefined();
    expect(document.paths?.['/logs']?.post).toBeDefined();
    expect(document.paths?.['/policy/bundle']?.get).toBeDefined();
  });

  it('emits reusable component schemas from the Zod schemas', () => {
    expect(document.components?.schemas?.['ExtensionLoginRequest']).toBeDefined();
    expect(document.components?.schemas?.['PolicyBundleResponse']).toBeDefined();
    expect(document.components?.schemas?.['LogEvent']).toBeDefined();
    expect(document.components?.schemas?.['ExtensionErrorEnvelope']).toBeDefined();
  });

  it('defines the bearer security scheme used by protected endpoints', () => {
    expect(document.components?.securitySchemes?.bearerAuth).toEqual({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    });
    expect(document.paths?.['/logs']?.post?.security).toEqual([{ bearerAuth: [] }]);
  });
});

describe('B3 core schemas and /health probe', () => {
  const document = buildOpenApiDocument();

  it('exposes the /health endpoint', () => {
    expect(document.paths?.['/health']?.get).toBeDefined();
  });

  it('documents the /health responses', () => {
    const health = document.paths?.['/health']?.get;
    expect(health?.responses?.['200']).toBeDefined();
    expect(health?.responses?.['503']).toBeDefined();
  });

  it('emits the health response schema as a reusable component', () => {
    expect(document.components?.schemas?.['HealthResponse']).toBeDefined();
  });

  it('emits the request-context and error-envelope schemas', () => {
    expect(document.components?.schemas?.['ErrorEnvelope']).toBeDefined();
    expect(document.components?.schemas?.['CorrelationId']).toBeDefined();
    expect(document.components?.schemas?.['RequestContext']).toBeDefined();
  });
});
