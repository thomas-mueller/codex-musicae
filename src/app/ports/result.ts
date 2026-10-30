/** Typed result used at every port boundary (ARC-005). No exception may cross a port. */
export type Result<T, E extends string> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E; readonly detail?: string };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E extends string>(error: E, detail?: string): Result<never, E> {
  return detail === undefined ? { ok: false, error } : { ok: false, error, detail };
}
