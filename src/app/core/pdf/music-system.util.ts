import type { MusicSystem } from './music-system.model';

export function expandMusicSystem(musicSystem: MusicSystem, padding: number): MusicSystem {
  return {
    ...musicSystem,
    xMin: Math.max(0, musicSystem.xMin - padding),
    yMin: Math.max(0, musicSystem.yMin - padding),
    xMax: Math.min(1, musicSystem.xMax + padding),
    yMax: Math.min(1, musicSystem.yMax + padding),
  };
}
