import { AsyncLocalStorage } from 'node:async_hooks';
import type { RequestContext } from '@hares/contract';

/**
 * Per-request context, correlated by `request_id` (DECISIONS #2).
 *
 * The correlation middleware uses `AsyncLocalStorage` so that the request id
 * set in middleware is carried through to the controller, interceptor and
 * exception filter for that request. Outside a request the store is undefined.
 */
export const requestContextStorage = new AsyncLocalStorage<RequestContext>();

/** Read the current request context (or `undefined` outside a request). */
export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}

/**
 * Run `callback` with the given `request_id` bound to the async context.
 * Returns the callback's return value (promise-safe).
 */
export function runWithRequestContext<T>(
  request_id: string,
  callback: () => T,
): T {
  return requestContextStorage.run({ request_id }, callback);
}
