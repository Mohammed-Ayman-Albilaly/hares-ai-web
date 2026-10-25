import { createRequire } from 'node:module';
import { Worker } from 'node:worker_threads';
import { PATTERN_FLAGS, PATTERN_MAX_LENGTH } from '@hares/contract';

export type PatternError =
  | 'rule.pattern_invalid'
  | 'rule.pattern_backreference'
  | 'rule.pattern_unsafe'
  | 'rule.pattern_timeout';
export type PatternCheck = { ok: true } | { ok: false; error: PatternError };

/** Hard time limit for the static analysis of one pattern (runs in a worker). */
export const ANALYSIS_TIMEOUT_MS = 3000;
/** Time limit for running the pattern on worst-case inputs, counted after the worker is ready. */
export const EXECUTION_TIMEOUT_MS = 250;
/** Upper bound for starting a worker (boot time is not charged to the execution test). */
const WORKER_BOOT_TIMEOUT_MS = 5000;
/** Work budget for the static analyser (steps of the backtracking simulation). */
const MAX_STEPS = 20_000;
/** At most this many validations run at once (each uses a thread). */
const MAX_CONCURRENT = 3;
/** Memory cap per worker; a huge compiled pattern cannot take the API down. */
const WORKER_LIMITS = { maxOldGenerationSizeMb: 64, maxYoungGenerationSizeMb: 16 } as const;

// Resolve the analyser's path once; the worker (plain JS, eval) loads it by path.
const REDOS_DETECTOR_PATH = createRequire(import.meta.url).resolve('redos-detector');

// Static analysis: redos-detector reports whether the pattern can backtrack
// catastrophically. Anything it cannot prove safe within the budget is unsafe.
// It uses the SAME flags the extension compiles the pattern with.
const ANALYSIS_SOURCE = `
const { parentPort, workerData } = require('node:worker_threads');
parentPort.postMessage({ ready: true });
const { isSafePattern } = require(workerData.detector);
const r = isSafePattern(workerData.pattern, {
  maxSteps: workerData.maxSteps,
  caseInsensitive: workerData.flags.includes('i'),
  unicode: workerData.flags.includes('u'),
});
parentPort.postMessage({ result: r.safe === true });
`;

// Execution test: run the pattern on worst-case style inputs (long runs of one
// character followed by a character that fails the match, mixed strings).
const EXECUTION_SOURCE = `
const { parentPort, workerData } = require('node:worker_threads');
const re = new RegExp(workerData.pattern, workerData.flags);
parentPort.postMessage({ ready: true });
const inputs = [
  'a'.repeat(5000) + '!',
  '0'.repeat(5000) + 'x',
  ' '.repeat(5000) + 'x',
  'ab'.repeat(2500) + '!',
  'A1-'.repeat(1700) + '!',
  'aA'.repeat(2500) + '!',
];
for (const s of inputs) re.test(s);
parentPort.postMessage({ result: true });
`;

/**
 * PATTERN safety (WEB-FR-036, WEB-NFR-006), in three layers:
 *  1. restricted syntax: length <= 512, a valid regular expression under the
 *     flags the extension uses (PATTERN_FLAGS), no backreferences;
 *  2. static analysis with redos-detector (catastrophic backtracking);
 *  3. an execution test on worst-case inputs, as a backstop for what the
 *     static analysis cannot see.
 * Layers 2 and 3 run in worker threads with a hard timeout and a memory cap,
 * at most MAX_CONCURRENT at a time, so neither the analysis nor the pattern
 * ever runs (or can hang or exhaust memory) on the API's main thread.
 */
export async function checkPattern(pattern: string): Promise<PatternCheck> {
  if (pattern.length === 0 || pattern.length > PATTERN_MAX_LENGTH) return { ok: false, error: 'rule.pattern_invalid' };
  try {
    new RegExp(pattern, PATTERN_FLAGS);
  } catch {
    return { ok: false, error: 'rule.pattern_invalid' };
  }
  // \1..\9 and \k<name> (conservative: also matches inside a character class).
  if (/\\(?:[1-9]|k<)/.test(pattern)) return { ok: false, error: 'rule.pattern_backreference' };

  return withSlot(async () => {
    const safe = await runInWorker(
      ANALYSIS_SOURCE,
      { pattern, flags: PATTERN_FLAGS, detector: REDOS_DETECTOR_PATH, maxSteps: MAX_STEPS },
      ANALYSIS_TIMEOUT_MS,
    );
    if (safe !== true) return { ok: false, error: 'rule.pattern_unsafe' } as const;

    const finished = await runInWorker(EXECUTION_SOURCE, { pattern, flags: PATTERN_FLAGS }, EXECUTION_TIMEOUT_MS);
    return finished === true ? ({ ok: true } as const) : ({ ok: false, error: 'rule.pattern_timeout' } as const);
  });
}

// ---------- concurrency cap ----------

let active = 0;
const waiting: Array<() => void> = [];

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT) await new Promise<void>((resolve) => waiting.push(resolve));
  active += 1;
  try {
    return await fn();
  } finally {
    active -= 1;
    waiting.shift()?.();
  }
}

// ---------- worker runner ----------

/**
 * Runs `source` in a worker. The worker first posts `{ ready: true }`; the
 * `timeoutMs` budget starts then, so worker start-up time on a busy machine
 * never makes a safe pattern look slow. Resolves with the worker's result, or
 * `undefined` on timeout, error or an unexpected exit.
 */
function runInWorker(source: string, workerData: Record<string, unknown>, timeoutMs: number): Promise<unknown> {
  return new Promise((resolve) => {
    let worker: Worker;
    let timer: NodeJS.Timeout | undefined;
    let done = false;
    const finish = (value: unknown) => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      void worker?.terminate();
      resolve(value);
    };
    try {
      worker = new Worker(source, { eval: true, workerData, resourceLimits: WORKER_LIMITS });
    } catch {
      return resolve(undefined);
    }
    timer = setTimeout(() => finish(undefined), WORKER_BOOT_TIMEOUT_MS);
    worker.on('message', (m: { ready?: boolean; result?: unknown }) => {
      if (m.ready) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => finish(undefined), timeoutMs);
      } else if ('result' in m) {
        finish(m.result);
      }
    });
    worker.once('error', () => finish(undefined));
    worker.once('exit', () => finish(undefined));
  });
}
