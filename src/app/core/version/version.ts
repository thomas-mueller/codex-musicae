export interface ParsedVersion {
  raw: string;
  tag: string | null;
  commitsSinceTag: number | null;
  sha: string | null;
  dirty: boolean;
}

export function parseGitDescribe(raw: string): ParsedVersion {
  const normalized = raw.trim();
  const dirty = normalized.endsWith('-dirty');
  const value = dirty ? normalized.slice(0, -'-dirty'.length) : normalized;
  const tagged = /^(?<tag>v[^-]+)-(?<commits>\d+)-g(?<sha>[0-9a-f]+)$/.exec(value);
  const untagged = /^[0-9a-f]+$/.test(value);

  return {
    raw,
    tag: tagged?.groups?.['tag'] ?? null,
    commitsSinceTag: tagged?.groups?.['commits'] === undefined ? null : Number(tagged.groups['commits']),
    sha: tagged?.groups?.['sha'] ?? (untagged ? value : null),
    dirty,
  };
}
