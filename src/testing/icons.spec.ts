import { readFileSync } from 'node:fs';
import { TUNABLES } from '../config/tunables';
import { translate } from './transloco';

describe('icon assets', () => {
  const sprite = readFileSync('src/assets/icons/sprite.svg', 'utf8');
  const names = Object.values(TUNABLES.icons);

  it('UIX-010 the sprite has a symbol for every name in tunables.icons', () => {
    for (const name of names) {
      expect(sprite, name).toContain(`<symbol id="${name}"`);
    }
  });

  it('GEN-010 every icon key has an a11y label and a tooltip', () => {
    for (const key of Object.keys(TUNABLES.icons)) {
      expect(translate(`a11y.${key}`), key).toBeTruthy();
      expect(translate(`tooltip.${key}`), key).toBeTruthy();
    }
  });
});
