export function findUnusedDependencies(input: { declared: readonly string[]; specifiers: readonly string[]; configText: string; exceptions?: ReadonlySet<string> }): string[];
