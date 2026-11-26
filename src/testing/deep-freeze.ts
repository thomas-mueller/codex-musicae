/** Freezes a copy of `value` through and through, so that a function that mutates its input throws. */
export function frozen<T>(value: T): T {
  return freeze(structuredClone(value));
}

function freeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
