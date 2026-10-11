import type { MusicSystem } from './music-system.model';

export const CODEX_PDF_SETTINGS_ATTACHMENT_NAME = 'codex-musicae.json';

export interface CodexPdfSettings {
  version: 1;
  updatedAt: string;
  padding: number;
  aspectRatio: number;
  musicSystems: MusicSystem[];
}

export function isValidCodexPdfSettings(value: unknown): value is CodexPdfSettings {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate['version'] === 1 &&
    typeof candidate['padding'] === 'number' &&
    typeof candidate['aspectRatio'] === 'number' &&
    Array.isArray(candidate['musicSystems'])
  );
}
