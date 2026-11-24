import type { Page } from '@playwright/test';

/**
 * Share of sample points on the pages of the organization viewer's visible area that lie inside a drawn tile (0..1): "the PDF is displayed".
 * Points on the grey between pages do not count; 1 means every visible part of a page shows pixels. Decided in the page.
 */
const SAMPLE_GRID = 6; // sample points per side
const CELL_CENTER = 0.5; // the middle of a grid cell

export async function displayedShare(page: Page, grid = SAMPLE_GRID): Promise<number> {
  return page.evaluate(({ cells, centre }) => {
    const viewer = globalThis.document.querySelector('[data-testid="org-viewer"]');
    if (!viewer) return 0;
    const area = viewer.getBoundingClientRect();
    const pages = Array.from(viewer.querySelectorAll('[data-testid^="org-page-"]')).map((el) => el.getBoundingClientRect());
    const drawn = Array.from(viewer.querySelectorAll('canvas'))
      .filter((canvas) => canvas.style.visibility === 'visible' && canvas.width > 0)
      .map((canvas) => canvas.getBoundingClientRect());
    const inside = (r: DOMRect, x: number, y: number): boolean => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    let onPage = 0;
    let covered = 0;
    for (let i = 0; i < cells; i++) {
      for (let j = 0; j < cells; j++) {
        const x = area.left + ((i + centre) / cells) * area.width;
        const y = area.top + ((j + centre) / cells) * area.height;
        if (!pages.some((r) => inside(r, x, y))) continue;
        onPage++;
        if (drawn.some((r) => inside(r, x, y))) covered++;
      }
    }
    return onPage === 0 ? 0 : covered / onPage;
  }, { cells: grid, centre: CELL_CENTER });
}
