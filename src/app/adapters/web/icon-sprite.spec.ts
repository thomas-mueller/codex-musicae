import { TUNABLES } from '../../../config/tunables';
import { installIconSprite } from './icon-sprite';

const { url, elementId, idPrefix } = TUNABLES.iconSprite;
// The shape scripts/build-icons.mjs writes; that the real file has every icon is src/testing/icons.spec.ts.
const names = ['delete', 'close'];
const sprite = `<svg xmlns="http://www.w3.org/2000/svg">${names.map((name) => `<symbol id="${name}" viewBox="0 0 1 1"><path d="M0 0h1v1z"/></symbol>`).join('')}</svg>`;
const answer = (body: string, status = 200) => vi.fn(() => Promise.resolve(new Response(body, { status })));

describe('installIconSprite', () => {
  afterEach(() => document.getElementById(elementId)?.remove());

  it('UIX-010 puts the sprite into the document once, hidden, with every symbol under its prefixed id', async () => {
    const load = answer(sprite);
    await installIconSprite(document, load);
    await installIconSprite(document, answer(sprite));
    expect(load).toHaveBeenCalledWith(url);
    expect(document.querySelectorAll(`#${elementId}`)).toHaveLength(1);
    expect(document.getElementById(elementId)!.getAttribute('aria-hidden')).toBe('true');
    for (const name of names) {
      const symbol = document.getElementById(idPrefix + name);
      expect(symbol?.localName, name).toBe('symbol');
      expect(symbol?.namespaceURI, name).toBe('http://www.w3.org/2000/svg');
      expect(symbol?.querySelector('path'), name).not.toBeNull();
      expect(document.getElementById(name), name).toBeNull();
    }
  });

  it('UIX-010 a missing, broken or unreachable sprite adds nothing and does not fail', async () => {
    for (const load of [answer(sprite, 404), answer('<html></html>'), vi.fn(() => Promise.reject(new Error('offline')))]) {
      await expect(installIconSprite(document, load)).resolves.toBeUndefined();
      expect(document.getElementById(elementId)).toBeNull();
    }
  });
});
