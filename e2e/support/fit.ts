import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';

import { TUNABLES } from '../../src/config/tunables';

/** The long-text run of the fit tests (I18-006; V2-M5 S3, reused by V2-M16). */
export type Translations = Record<string, unknown>;

const FILLER_WORD = 'wwwww';

export const readTranslations = (language: string): Translations =>
  JSON.parse(readFileSync(`src/assets/i18n/${language}.json`, 'utf8')) as Translations;

/** Every text lengthened by `T:testing.longTextExtraRatio`, in separate words, so it may wrap. Empty texts stay empty. */
export function lengthen(translations: Translations): Translations {
  return Object.fromEntries(
    Object.entries(translations).map(([key, value]) => {
      if (typeof value !== 'string') {
        return [key, lengthen(value as Translations)];
      }
      let extra = Math.ceil(value.length * TUNABLES.testing.longTextExtraRatio);
      let text = value;
      while (extra > 0) {
        const word = FILLER_WORD.slice(0, extra);
        text += ` ${word}`;
        extra -= word.length;
      }
      return [key, text];
    }),
  );
}

/**
 * Serves the language file with lengthened texts and returns them. Call before `page.goto`, and block the service worker
 * (`test.use({ serviceWorkers: 'block' })`): it would answer instead of the route.
 */
export async function serveLongTexts(page: Page, language: string): Promise<Translations> {
  const long = lengthen(readTranslations(language));
  await page.route(`**/assets/i18n/${language}.json`, (route) => route.fulfill({ json: long }));
  return long;
}

/**
 * The texts below `root` that are cut off: wider than their box, clipped by a container or outside the window, and a
 * select whose chosen entry does not fit. Wrapped text is fine. File names are left out (shortened on purpose), and so
 * are tooltips (their own test).
 */
export function cutTexts(page: Page, root: string): Promise<string[]> {
  return page.locator(root).evaluateAll((roots) => {
    const TOLERANCE = 1;
    const IGNORED = '.name, app-tab-switcher, [role="tooltip"], svg, option, select';
    const cut: string[] = [];
    const outside = (rect: DOMRect, element: Element): boolean => {
      const page = element.ownerDocument;
      if (rect.left < -TOLERANCE || rect.right > page.documentElement.clientWidth + TOLERANCE) {
        return true;
      }
      for (let box: Element | null = element; box && box !== page.body; box = box.parentElement) {
        const style = getComputedStyle(box);
        const bounds = box.getBoundingClientRect();
        if (style.overflowX !== 'visible' && (rect.left < bounds.left - TOLERANCE || rect.right > bounds.right + TOLERANCE)) {
          return true;
        }
        const clipsHeight = style.overflowY === 'hidden' || style.overflowY === 'clip';
        if (clipsHeight && (rect.top < bounds.top - TOLERANCE || rect.bottom > bounds.bottom + TOLERANCE)) {
          return true;
        }
      }
      return false;
    };
    for (const element of roots.flatMap((r) => [r, ...r.querySelectorAll('*')])) {
      if (element instanceof HTMLSelectElement) {
        // the width the chosen entry needs: a copy that holds only that entry and sizes itself
        const copy = element.cloneNode(false) as HTMLSelectElement;
        copy.append(element.options[element.selectedIndex]!.cloneNode(true));
        // "important": a style rule that narrows the select must not narrow the copy as well
        for (const [property, value] of [['position', 'absolute'], ['visibility', 'hidden'], ['width', 'auto'], ['max-width', 'none']]) {
          copy.style.setProperty(property!, value!, 'important');
        }
        element.after(copy);
        const needed = copy.getBoundingClientRect().width;
        copy.remove();
        const box = element.getBoundingClientRect();
        if (needed > box.width + TOLERANCE || outside(box, element.parentElement!)) {
          cut.push(`select: ${element.options[element.selectedIndex]!.text}`);
        }
        continue;
      }
      if (element.closest(IGNORED)) {
        continue;
      }
      for (const node of element.childNodes) {
        if (node.nodeType !== Node.TEXT_NODE || !node.textContent?.trim()) {
          continue;
        }
        const range = element.ownerDocument.createRange();
        range.selectNodeContents(node);
        const wider = element.clientWidth > 0 && element.scrollWidth > element.clientWidth + TOLERANCE;
        if (wider || [...range.getClientRects()].some((rect) => outside(rect, element))) {
          cut.push(node.textContent.trim());
        }
      }
    }
    return cut;
  });
}
