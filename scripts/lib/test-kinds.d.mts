export interface TestKind {
  id: string;
  label: string;
  vitest: boolean;
  patterns: string[];
}
export interface KindRow extends TestKind {
  files: number;
  tests: number;
}
export function countTests(text: string): number;
export function kindOf(path: string, kinds: readonly TestKind[]): TestKind | null;
export function countByKind(files: Record<string, string>, kinds: readonly TestKind[]): KindRow[];
export function renderTable(rows: readonly KindRow[], coverage: { lines: { pct: number }; branches: { pct: number } } | null): string;
