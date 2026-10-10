export interface MusicSystem {
  page: number;
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
  boxOrder?: number;
}

export function compareMusicSystemsInPdfOrder(a: MusicSystem, b: MusicSystem): number {
  return a.page - b.page || a.yMin - b.yMin || a.xMin - b.xMin;
}

export function orderMusicSystems(musicSystems: readonly MusicSystem[]): MusicSystem[] {
  return [...musicSystems]
    .sort(compareMusicSystemsInPdfOrder)
    .map((musicSystem, index) => ({ ...musicSystem, boxOrder: index + 1 }));
}
