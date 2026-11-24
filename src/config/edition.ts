/** The edition a build is made for; set by the build constant EDITION (angular.json, EDN-010). */
export type Edition = 'free' | 'paid';

/**
 * EDN-006, EDN-012: the paid native build enables every switch of the feature file; any other edition keeps the file as it is.
 * Pure: returns a new frozen object and never changes its input.
 */
export function resolveFeatures<T extends Record<string, boolean>>(features: T, edition: Edition): Readonly<T> {
  const entries = Object.entries(features).map(([key, value]) => [key, edition === 'paid' ? true : value]);
  return Object.freeze(Object.fromEntries(entries) as T);
}
