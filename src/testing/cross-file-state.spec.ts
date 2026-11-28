import { TUNABLES } from '../config/tunables';
import { PREFERENCES } from '../app/ports/preferences';
import { err, ok } from '../app/ports/result';
import { TestBed } from '@angular/core/testing';

import { CrossFileChoices } from '../app/state/cross-file-choices';
import { SettingsReset } from '../app/state/settings-reset';
import { SlideNavStore } from '../app/state/slide-nav.store';
import { StrokeGate } from '../app/state/stroke-gate';
import type { memoryPreferences } from '../app/state/testing/fake-ports';
import { jumpInto } from './cross-file-files';
import { crossFileSetup, settle } from './cross-file-setup';
import { ALL_FEATURES_ON } from './provide-test-ports';
import type { FeatureFlags } from '../app/ports/feature-flags';

const FREE = Object.fromEntries(Object.keys(ALL_FEATURES_ON).map((key) => [key, false])) as unknown as FeatureFlags;
/** A.pdf plays system 1 and 2, then leads into system 2 of B.pdf. */
const A_INTO_B = { 'A.pdf': { jumps: [jumpInto('B.pdf', 2)] } };

describe('opening referenced files', () => {
  it('FIL-042 FIL-045 a referenced file of the recent list opens in the background and keeps its place in that list', async () => {
    const s = await crossFileSetup({ marks: A_INTO_B, stored: ['B.pdf'] });
    await s.open('A.pdf');
    expect(s.openNames()).toEqual(['A.pdf', 'B.pdf']);
    expect(s.current()).toBe('A.pdf');
    expect(s.doc('B.pdf').shown).toBe(false);
    expect(s.preferences.recentFiles().map((ref) => ref.name)).toEqual(['A.pdf', 'B.pdf']);
    expect(s.crossFile.notice()).toBeNull();
  });

  it('FIL-042 FIL-045 references of references are followed, and a loop opens every file once', async () => {
    const s = await crossFileSetup({
      marks: {
        ...A_INTO_B,
        'B.pdf': { jumps: [jumpInto('C.pdf', 3)] },
        'C.pdf': { bookmarks: [{ id: 1, at: { pageIndex: 0, system: 1 }, ref: { file: 'A.pdf', pageIndex: 0, system: 1 } }] },
      },
      stored: ['B.pdf', 'C.pdf'],
    });
    await s.open('A.pdf');
    await settle();
    expect(s.openNames()).toEqual(['A.pdf', 'B.pdf', 'C.pdf']);
    expect(s.reopen).toHaveBeenCalledTimes(2);
    expect(s.current()).toBe('A.pdf');
  });

  it('FIL-042 nothing is opened before the files of the last session are back', async () => {
    const s = await crossFileSetup({ marks: A_INTO_B, stored: ['B.pdf'], restored: false });
    await s.open('A.pdf');
    expect(s.openNames()).toEqual(['A.pdf']);
    await s.session.restore();
    await settle();
    expect(s.openNames()).toEqual(['A.pdf', 'B.pdf']);
  });

  it('FIL-043 a file that is not found is warned about once for these two files, whatever happens later', async () => {
    const s = await crossFileSetup({ marks: A_INTO_B });
    await s.open('A.pdf');
    const notice = s.crossFile.notice()!;
    expect(notice).toEqual({ kind: 'unresolved', referrerId: s.idOf('A.pdf'), name: 'B.pdf', reason: 'missing-file' });
    s.crossFile.dismiss(notice);
    await s.session.closeTab(s.idOf('A.pdf'));
    await s.open('A.pdf');
    expect(s.crossFile.notice()).toBeNull();
  });

  it('FIL-043 two files of the name in the recent list are not opened', async () => {
    const s = await crossFileSetup({ marks: A_INTO_B, stored: ['B.pdf'] });
    await s.preferences.addRecent({ id: 'other', name: 'B.pdf' });
    await s.open('A.pdf');
    expect(s.openNames()).toEqual(['A.pdf']);
    expect(s.reopen).not.toHaveBeenCalled();
    expect(s.crossFile.notice()).toMatchObject({ reason: 'ambiguous' });
  });

  it('FIL-043 two open files of the name are ambiguous, and neither is played into', async () => {
    const s = await crossFileSetup({ marks: A_INTO_B });
    await s.open('B.pdf', 'first');
    await s.open('B.pdf', 'second');
    await s.open('A.pdf');
    expect(s.crossFile.notice()).toMatchObject({ reason: 'ambiguous' });
    s.toEnd();
    expect(s.playback.canContinue()).toBe(false);
  });

  it('FIL-043 where only the permission is missing, "open file" asks for it inside the tap', async () => {
    const s = await crossFileSetup({ marks: A_INTO_B, stored: ['B.pdf'] });
    s.reopen.mockResolvedValueOnce(err('needs-user-gesture'));
    await s.open('A.pdf');
    const notice = s.crossFile.notice()!;
    expect(notice).toMatchObject({ reason: 'no-access' });
    const pick = vi.spyOn(s.files, 'pickPdfs');
    const opening = s.crossFile.openMissing(notice as never);
    expect(s.reopen).toHaveBeenCalledTimes(2); // before anything waited
    await opening;
    await settle();
    expect(pick).not.toHaveBeenCalled();
    expect(s.openNames()).toEqual(['A.pdf', 'B.pdf']);
    expect(s.current()).toBe('A.pdf');
    expect(s.crossFile.notice()).toBeNull();
  });

  it('FIL-043 FIL-045 a missing file is chosen by hand, opens in the background and the warning goes', async () => {
    const s = await crossFileSetup({ marks: A_INTO_B });
    await s.open('A.pdf');
    s.files.pickPdfs = () => Promise.resolve(ok([s.file('B.pdf')]));
    await s.crossFile.openMissing(s.crossFile.notice() as never);
    await settle();
    expect(s.current()).toBe('A.pdf');
    expect(s.openNames()).toEqual(['A.pdf', 'B.pdf']);
    expect(s.crossFile.notice()).toBeNull();
    expect(s.preferences.recentFiles().map((ref) => ref.name)).toContain('B.pdf');
  });

  it('MRK-015 a target line that does not exist is warned about, and the source file is neither changed nor written', async () => {
    const marks = { jumps: [jumpInto('B.pdf', 2, 1, 9)] };
    const s = await crossFileSetup({ marks: { 'A.pdf': marks }, stored: ['B.pdf'] });
    await s.open('A.pdf');
    expect(s.crossFile.notice()).toMatchObject({ name: 'B.pdf', reason: 'missing-system' });
    s.doc('B.pdf').addStroke({ id: 'x', pageIndex: 0, points: [{ x: 1, y: 1 }], color: '#000000', widthPt: 1, opacity: 1, multiply: false });
    await settle();
    expect(s.doc('A.pdf').systemMarks().jumps).toEqual(marks.jumps);
    expect(s.session.tabs().find((tab) => tab.name === 'A.pdf')!.unsaved).toBe(false);
    expect(s.files.write).not.toHaveBeenCalled();
  });

  it('MRK-016 while the target is still being read there is no warning and no way on', async () => {
    const s = await crossFileSetup({ marks: A_INTO_B });
    s.writer.readEmbeddedJson.mockImplementationOnce(() => Promise.resolve(ok(null)));
    await s.open('B.pdf'); // nothing embedded: detection starts and waits
    s.writer.readEmbeddedJson.mockClear();
    await s.open('A.pdf');
    expect(s.crossFile.stateOf(s.idOf('A.pdf'), jumpInto('B.pdf', 2).to).state).toBe('pending');
    expect(s.crossFile.notice()).toBeNull();
    s.toEnd();
    expect(s.playback.canContinue()).toBe(false);
  });
});

describe('closing a referenced file', () => {
  async function closeB() {
    const s = await crossFileSetup({ marks: A_INTO_B, stored: ['B.pdf'] });
    await s.open('A.pdf');
    await s.session.closeTab(s.idOf('B.pdf'));
    await settle();
    return s;
  }

  it('FIL-044 keeps the marks, warns at once, and no second warning or automatic opening follows', async () => {
    const s = await closeB();
    const notice = s.crossFile.notice()!;
    expect(notice).toEqual({ kind: 'closed', name: 'B.pdf', referrers: ['A.pdf'] });
    expect(s.doc('A.pdf').systemMarks().jumps).toHaveLength(1);
    s.crossFile.dismiss(notice);
    await settle();
    expect(s.crossFile.notice()).toBeNull();
    expect(s.openNames()).toEqual(['A.pdf']);
  });

  it('FIL-044 closing a file nothing refers to warns about nothing', async () => {
    const s = await crossFileSetup();
    await s.open('A.pdf');
    await s.open('B.pdf');
    await s.session.closeTab(s.idOf('B.pdf'));
    await settle();
    expect(s.crossFile.notice()).toBeNull();
  });

  it('FIL-044 "don\'t show again" is stored and "reset all settings" clears it', async () => {
    const s = await closeB();
    await s.crossFile.silenceCloseWarning();
    expect(s.crossFile.notice()).toBeNull();
    const stored = TestBed.inject(PREFERENCES) as ReturnType<typeof memoryPreferences>;
    expect(stored.data.get(TUNABLES.persistence.crossFileCloseKey)).toBe(true);
    await s.open('B.pdf');
    await s.session.closeTab(s.idOf('B.pdf'));
    await settle();
    expect(s.crossFile.notice()).toBeNull();
    await TestBed.inject(SettingsReset).resetAll();
    expect(TestBed.inject(CrossFileChoices).closeSilenced()).toBe(false);
    expect(stored.data.has(TUNABLES.persistence.crossFileCloseKey)).toBe(false);
  });

  it('FIL-043 FIL-044 no warning shows in presentation mode or while a stroke is drawn; it waits', async () => {
    const s = await closeB();
    s.ui.hasDocument.set(true);
    s.ui.setMode('presentation');
    expect(s.crossFile.notice()).toBeNull();
    s.ui.setMode('annotation');
    s.ui.strokeInProgress.set(true);
    expect(s.crossFile.notice()).toBeNull();
    s.ui.strokeInProgress.set(false);
    expect(s.crossFile.notice()).not.toBeNull();
  });
});

describe('playing across files', () => {
  /** A leads into B at system 2; B leads from system 3 back to the first system of A. */
  const LOOP = { ...A_INTO_B, 'B.pdf': { jumps: [jumpInto('A.pdf', 3, 1, 1)] } };

  async function opened(marks: Parameters<typeof crossFileSetup>[0] = { marks: A_INTO_B, stored: ['B.pdf'] }) {
    const s = await crossFileSetup(marks);
    await s.open('A.pdf');
    return { ...s, nav: TestBed.inject(SlideNavStore) };
  }

  it('FIL-051 PLY-017 next at the cross-file jump continues in the other file at the target line', async () => {
    const s = await opened();
    expect(s.doc('A.pdf').playingOrder().entries).toEqual([1, 2]);
    s.toEnd();
    expect(s.nav.canNext()).toBe(true);
    s.playback.step(1);
    expect(s.here()).toBe('B.pdf:2');
    expect(s.doc('B.pdf').playingOrder().entries).toEqual([2, 3, 4, 5, 6]);
    expect(s.session.activeDocument()!.currentSlideIndex()).toBe(0);
  });

  it('FIL-052 previous at the arrival goes back to the slide of the jump, and the other file has its own order again', async () => {
    const s = await opened();
    s.toEnd();
    const left = s.here();
    s.playback.step(1);
    expect(s.nav.canPrevious()).toBe(true);
    s.playback.step(-1);
    expect(s.here()).toBe(left);
    expect(s.doc('B.pdf').playingOrder().entries).toEqual([1, 2, 3, 4, 5, 6]);
    expect(s.playback.canReturn()).toBe(false);
  });

  it('FIL-051 FIL-052 jumps back and forth form a chain, and every previous goes one step back', async () => {
    const s = await opened({ marks: LOOP, stored: ['B.pdf'] });
    const trail: string[] = [];
    for (let turn = 0; turn < 3; turn++) {
      s.toEnd();
      trail.push(s.here());
      s.playback.step(1);
    }
    expect(s.here()).toBe('B.pdf:2');
    for (const expected of [...trail].reverse()) {
      s.session.activeDocument()!.goToSlide(0);
      s.playback.step(-1);
      TestBed.tick();
      expect(s.here()).toBe(expected);
    }
    expect(s.doc('A.pdf').arrival()).toBeNull();
    expect(s.doc('B.pdf').arrival()).toBeNull();
  });

  it('MRK-016 with the file missing the presentation ends at the jump; once it is there, next goes on', async () => {
    const s = await opened({ marks: A_INTO_B });
    s.toEnd();
    expect(s.nav.canNext()).toBe(false);
    s.playback.step(1);
    expect(s.current()).toBe('A.pdf');
    await s.open('B.pdf');
    s.session.setActive(s.idOf('A.pdf'));
    await settle();
    s.toEnd();
    expect(s.nav.canNext()).toBe(true);
    s.playback.step(1);
    expect(s.here()).toBe('B.pdf:2');
  });

  for (const [how, leave] of [
    ['choosing a file', (s: Awaited<ReturnType<typeof opened>>) => s.session.setActive(s.idOf('A.pdf'))],
    ['organization mode', (s: Awaited<ReturnType<typeof opened>>) => s.ui.setMode('organization')],
    ['the settings', (s: Awaited<ReturnType<typeof opened>>) => s.ui.setMode('settings')],
    ['closing the file left behind', (s: Awaited<ReturnType<typeof opened>>) => void s.session.closeTab(s.idOf('A.pdf'))],
  ] as const) {
    it(`FIL-052 ${how} ends the chain, and the file shows its own order again`, async () => {
      const s = await opened();
      s.toEnd();
      s.playback.step(1);
      await settle();
      leave(s);
      await settle();
      expect(s.playback.canReturn()).toBe(false);
      expect(s.doc('B.pdf').arrival()).toBeNull();
      expect(s.doc('B.pdf').playingOrder().entries).toEqual([1, 2, 3, 4, 5, 6]);
    });
  }

  it('FIL-051 presentation mode keeps the chain', async () => {
    const s = await opened();
    s.toEnd();
    s.playback.step(1);
    s.ui.hasDocument.set(true);
    s.ui.setMode('presentation');
    await settle();
    expect(s.ui.mode()).toBe('presentation');
    expect(s.playback.canReturn()).toBe(true);
  });

  it('ANN-013 FIL-051 a turn into another file waits for the stroke to end', async () => {
    const s = await opened();
    s.toEnd();
    TestBed.inject(StrokeGate);
    s.ui.strokeInProgress.set(true);
    TestBed.tick();
    s.nav.next();
    expect(s.current()).toBe('A.pdf');
    s.ui.strokeInProgress.set(false);
    TestBed.tick();
    expect(s.current()).toBe('B.pdf');
  });

  it('FIL-051 a page turn asks for no write permission', async () => {
    const s = await opened();
    s.doc('B.pdf').needsWriteAccess.set(true);
    s.toEnd();
    s.playback.step(1);
    expect(s.files.requestWriteAccess).not.toHaveBeenCalled();
  });

  it('MRK-017 the free edition opens and plays referenced files in the same way', async () => {
    const s = await opened({ marks: A_INTO_B, stored: ['B.pdf'], flags: FREE });
    expect(s.openNames()).toEqual(['A.pdf', 'B.pdf']);
    s.toEnd();
    s.playback.step(1);
    expect(s.here()).toBe('B.pdf:2');
    expect(s.files.write).not.toHaveBeenCalled();
  });
});
