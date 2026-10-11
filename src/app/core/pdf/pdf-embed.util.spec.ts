import { describe, expect, it } from 'vitest';
import { PDFDocument, encodeToBase64 } from 'pdf-lib';
import { embedSettingsInPdf, extractSettingsFromPdf } from './pdf-embed.util';
import type { CodexPdfSettings } from './pdf-settings.model';

describe('pdf-embed.util', () => {
  it('embeds settings and extracts them correctly from a PDF', async () => {
    // Create a minimal PDF
    const doc = await PDFDocument.create();
    doc.addPage([400, 600]);
    const originalBytes = await doc.save();

    // Verify initially no settings
    const initialExtracted = await extractSettingsFromPdf(originalBytes);
    expect(initialExtracted).toBeNull();

    // Settings to embed
    const settings: CodexPdfSettings = {
      version: 1,
      updatedAt: new Date().toISOString(),
      padding: 0.035,
      aspectRatio: 1.2,
      musicSystems: [
        { page: 1, xMin: 0.1, yMin: 0.2, xMax: 0.9, yMax: 0.35, selectedPosition: 1 },
        { page: 1, xMin: 0.1, yMin: 0.4, xMax: 0.9, yMax: 0.55, selectedPosition: 2 },
      ],
    };

    // Embed
    const modifiedBytes = await embedSettingsInPdf(originalBytes, settings);
    expect(modifiedBytes.length).toBeGreaterThan(originalBytes.length);

    // Extract
    const extracted = await extractSettingsFromPdf(modifiedBytes);
    expect(extracted).not.toBeNull();
    expect(extracted?.version).toBe(1);
    expect(extracted?.padding).toBe(0.035);
    expect(extracted?.aspectRatio).toBe(1.2);
    expect(extracted?.musicSystems.length).toBe(2);
    expect(extracted?.musicSystems[0].selectedPosition).toBe(1);
  });

  it('replaces an existing settings attachment on repeated saves', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([400, 600]);
    const originalBytes = await doc.save();
    const first = await embedSettingsInPdf(originalBytes, { version: 1, updatedAt: 'old', padding: 0.03, aspectRatio: 1, musicSystems: [] });
    const second = await embedSettingsInPdf(first, { version: 1, updatedAt: 'new', padding: 0.04, aspectRatio: 1.2, musicSystems: [] });
    const extracted = await extractSettingsFromPdf(second);
    expect(extracted?.updatedAt).toBe('new');
    expect(second.length).toBeLessThan(first.length + 1000);
  });

  it('loads legacy ratio and box-order field names', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([400, 600]);
    await doc.attach(encodeToBase64(new TextEncoder().encode(JSON.stringify({
      version: 1, updatedAt: 'legacy', padding: 0.03, aspectRatioAdjustment: 0.2,
      musicSystems: [{ page: 1, xMin: 0, yMin: 0, xMax: 1, yMax: 1, boxOrder: 3 }],
    }))), 'codex-musicae.json');
    const extracted = await extractSettingsFromPdf(await doc.save());
    expect(extracted?.aspectRatio).toBe(0.2);
    expect(extracted?.musicSystems[0].selectedPosition).toBe(3);
  });
});
