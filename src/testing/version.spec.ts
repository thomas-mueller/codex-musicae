import { displayVersion, platformVersionName } from '../../scripts/lib/version.mjs';

const SAMPLES = ['v1.5.0-3-gabc1234-dirty', 'v1.1.0-0-g8b69cff', 'v2.0.0', 'v0.20.0-14-g8b69cff-dirty', 'abc1234', 'unknown', ''];

describe('version forms', () => {
  it('PIP-018 the display version is vX.Y.Z with Z = patch of the nearest tag + commits since it', () => {
    expect(displayVersion('v1.5.0-3-gabc1234-dirty')).toBe('v1.5.3');
    expect(displayVersion('v1.1.0-19-g7c581e9')).toBe('v1.1.19');
    expect(displayVersion('v1.5.0-0-gabc1234')).toBe('v1.5.0');
    expect(displayVersion('v2.0.0')).toBe('v2.0.0');
  });

  it('PIP-018 a fix tag adds its commits to its own patch number', () => {
    expect(displayVersion('v1.1.5-3-gabc1234')).toBe('v1.1.8');
  });

  it('PIP-018 the dirty flag and the hash do not change the display version', () => {
    expect(displayVersion('v1.5.0-3-gabc1234-dirty')).toBe(displayVersion('v1.5.0-3-gdef5678'));
  });

  it('PIP-018 without a tag the display version is v0.0.0', () => {
    for (const raw of ['abc1234', 'abc1234-dirty', 'unknown', '']) {
      expect(displayVersion(raw)).toBe('v0.0.0');
    }
  });

  it('PIP-019 the Android and iOS version name is X.Y.Z without v and without a describe suffix', () => {
    expect(platformVersionName('v1.5.0-3-gabc1234-dirty')).toBe('1.5.3');
    expect(platformVersionName('v2.0.0')).toBe('2.0.0');
    expect(platformVersionName('abc1234')).toBe('0.0.0');
    for (const raw of SAMPLES) {
      expect(platformVersionName(raw)).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  it('PIP-020 the web, Android and iOS versions are the same numbers for every describe string', () => {
    for (const raw of SAMPLES) {
      expect(`v${platformVersionName(raw)}`).toBe(displayVersion(raw));
    }
  });
});
