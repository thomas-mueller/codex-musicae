import { TUNABLES } from '../../../config/tunables';

/**
 * Puts the icon sprite into the document once, so every icon is a reference within the page (UIX-010). A `<use>` of the
 * sprite file would request it again for each icon that is added later, and on a first visit the installing service
 * worker holds such a request for seconds: the icon stays blank. The ids get a prefix, so a symbol such as `delete`
 * cannot collide with another element. A failed load leaves the buttons without glyphs; they keep their labels.
 */
export async function installIconSprite(document: Document, load: typeof fetch = (input) => fetch(input)): Promise<void> {
  const { url, elementId, idPrefix } = TUNABLES.iconSprite;
  try {
    const response = await load(url);
    if (!response.ok) {
      return;
    }
    const parsed = new DOMParser().parseFromString(await response.text(), 'image/svg+xml');
    const symbols = parsed.querySelectorAll('symbol');
    if (symbols.length === 0 || document.getElementById(elementId) !== null) {
      return;
    }
    symbols.forEach((symbol) => (symbol.id = idPrefix + symbol.id));
    const sprite = document.importNode(parsed.documentElement, true);
    sprite.id = elementId;
    sprite.setAttribute('aria-hidden', 'true');
    // Not `display: none`: the symbols must stay usable. No size, no place in the layout.
    sprite.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden');
    document.body.prepend(sprite);
  } catch {
    // offline without a cached sprite: nothing to draw
  }
}
