import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { PdfPersistenceService } from './pdf-persistence.service';
import { PdfStateService } from './pdf-state.service';
import { MusicSystemService } from './music-system.service';
import { PDFDocument } from 'pdf-lib';

describe('PdfPersistenceService', () => {
  let persistenceService: PdfPersistenceService;
  let pdfState: PdfStateService;
  let musicSystemService: MusicSystemService;

  beforeEach(() => {
    pdfState = new PdfStateService();
    musicSystemService = new MusicSystemService();
    persistenceService = new PdfPersistenceService(pdfState, musicSystemService);
  });

  afterEach(() => {
    persistenceService.ngOnDestroy();
    pdfState.ngOnDestroy();
  });

  it('manages configurable auto-save interval', () => {
    expect(persistenceService.getIntervalMinutes()).toBe(10);
    persistenceService.setIntervalMinutes(15);
    expect(persistenceService.getIntervalMinutes()).toBe(15);
  });

  it('embeds settings and saves document bytes in state', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([200, 300]);
    const originalBytes = await doc.save();

    pdfState.setDocumentBytes(originalBytes, 'score.pdf');
    musicSystemService.setEditorState(
      [{ page: 1, xMin: 0.2, yMin: 0.3, xMax: 0.8, yMax: 0.5, selectedPosition: 1 }],
      0.03,
      1.25,
    );

    const saved = await persistenceService.save({ silent: true });
    expect(saved).toBe(true);
    expect(persistenceService.lastSavedAt()).not.toBeNull();

    const savedBytes = pdfState.pdfBytes();
    expect(savedBytes).not.toBeNull();
    expect(savedBytes!.length).toBeGreaterThan(originalBytes.length);

    // Extract settings from the saved bytes
    const newMusicService = new MusicSystemService();
    const newPersistenceService = new PdfPersistenceService(pdfState, newMusicService);
    const loadedSettings = await newPersistenceService.loadAndExtractSettings(savedBytes!);

    expect(loadedSettings).not.toBeNull();
    expect(loadedSettings?.padding).toBe(0.03);
    expect(loadedSettings?.aspectRatio).toBe(1.25);
    expect(loadedSettings?.musicSystems.length).toBe(1);
    expect(newMusicService.padding()).toBe(0.03);
    expect(newMusicService.aspectRatio()).toBe(1.25);
    expect(newMusicService.musicSystems()[0].selectedPosition).toBe(1);
    expect(newMusicService.musicSystems().length).toBe(1);

    newPersistenceService.ngOnDestroy();
  });
});
