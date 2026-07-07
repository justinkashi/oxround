// Resilience utilities (VERSION 2): exponential-backoff retry, idempotency keys,
// friendly error mapping. Used by every mutation in lib/data.ts.
"use client";

import { getMessages } from "@/lib/i18n";

// HTTP statuses worth retrying: rate limit + temporary gateway/server overload.
const RETRY_STATUSES = new Set([429, 502, 503, 504]);
const RETRY_DELAYS_MS = [1000, 2000, 4000]; // 3 attempts total after the first

type SbResponse<T> = { data: T; error: unknown; status?: number };

function isNetworkError(e: unknown): boolean {
  // fetch() rejects with TypeError on network failure in every browser.
  return e instanceof TypeError || (e instanceof Error && /fetch|network/i.test(e.message));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Re-runs `build` (a factory that creates a FRESH query each attempt — Supabase
// query builders are one-shot thenables) on 429/502/503/504 or a network drop.
// 1s → 2s → 4s, then gives up and surfaces the last error/response.
export async function withRetry<T>(build: () => PromiseLike<SbResponse<T>>): Promise<SbResponse<T>> {
  let last: SbResponse<T> | null = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      last = await build();
    } catch (e) {
      if (isNetworkError(e) && attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      throw e;
    }
    const status = last?.status;
    if (status && RETRY_STATUSES.has(status) && attempt < RETRY_DELAYS_MS.length) {
      await sleep(RETRY_DELAYS_MS[attempt]);
      continue;
    }
    return last;
  }
  return last as SbResponse<T>;
}

// Frontend-generated idempotency key. Inserted into the row's UNIQUE client_key
// column: if a double-click or an automatic retry re-sends the same creation,
// Postgres rejects the duplicate (23505) and we treat it as already-succeeded.
export function newClientKey(): string {
  return crypto.randomUUID();
}

type PgError = { code?: string; message?: string };

export function isIdempotentReplay(error: unknown): boolean {
  const e = error as PgError | null;
  return !!e && e.code === "23505" && /client_key/.test(e.message ?? "");
}

// Map raw Postgres/PostgREST errors to something a gym owner can act on,
// in the user's chosen language.
export function friendlyDbError(error: unknown): string {
  const t = getMessages();
  const e = error as PgError | null;
  if (!e) return t.common.somethingWentWrong;
  const msg = e.message ?? t.common.somethingWentWrong;
  if (e.code === "23505") return t.errors.duplicate;
  if (e.code === "23503") return t.errors.badReference;
  if (e.code === "23514") return t.errors.valueNotAllowed;
  if (e.code === "42501") return t.errors.noPermission;
  return msg;
}

// Executes a mutation with retry + idempotency handling and throws a friendly
// Error on failure. `build` must create a fresh query per call.
export async function exec<T>(build: () => PromiseLike<SbResponse<T>>): Promise<T> {
  const res = await withRetry(build);
  if (res.error) {
    if (isIdempotentReplay(res.error)) return res.data as T; // replayed create → OK
    throw new Error(friendlyDbError(res.error));
  }
  return res.data as T;
}
