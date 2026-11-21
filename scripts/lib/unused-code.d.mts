export function parseExceptions(text: string): Map<string, string>;
export function findUnused(input: { sources: Record<string, string>; entries: readonly string[]; exceptions?: ReadonlySet<string> }): string[];
