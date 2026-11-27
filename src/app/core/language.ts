/** core/language — which of the app's languages to show. Requirement: I18-004. */

const primaryOf = (tag: string): string => tag.toLowerCase().split('-')[0] ?? '';

/**
 * The system's preferred languages are tried in their order. Each one matches an available language exactly, else by its
 * primary language (`de-AT` -> `de`, `pt-PT` -> `pt-BR`); case is ignored. Nothing matches -> `fallback`.
 */
export function selectLanguage<L extends string>(preferred: readonly string[], available: readonly L[], fallback: L): L {
  for (const tag of preferred) {
    const match =
      available.find((language) => language.toLowerCase() === tag.toLowerCase()) ??
      available.find((language) => primaryOf(language) === primaryOf(tag));
    if (match !== undefined) {
      return match;
    }
  }
  return fallback;
}
