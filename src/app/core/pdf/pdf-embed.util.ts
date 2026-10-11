import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFArray,
  PDFString,
  PDFHexString,
  PDFRawStream,
  decodePDFRawStream,
  encodeToBase64,
} from 'pdf-lib';
import {
  CODEX_PDF_SETTINGS_ATTACHMENT_NAME,
  isValidCodexPdfSettings,
  type CodexPdfSettings,
} from './pdf-settings.model';
import type { MusicSystem } from './music-system.model';

export async function embedSettingsInPdf(
  pdfBytes: Uint8Array,
  settings: CodexPdfSettings,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const jsonString = JSON.stringify(settings, null, 2);
  const jsonBytes = new TextEncoder().encode(jsonString);
  const base64Attachment = encodeToBase64(jsonBytes);

  // Attach as standard embedded file (PDF /EmbeddedFiles)
  removeExistingAttachment(pdfDoc, CODEX_PDF_SETTINGS_ATTACHMENT_NAME);
  await pdfDoc.attach(base64Attachment, CODEX_PDF_SETTINGS_ATTACHMENT_NAME, {
    mimeType: 'application/json',
    description: 'Codex Musicae Document Settings',
    creationDate: new Date(),
    modificationDate: new Date(),
  });

  return await pdfDoc.save();
}

function removeExistingAttachment(pdfDoc: PDFDocument, targetFileName: string): void {
  const namesDict = pdfDoc.catalog.lookup(PDFName.of('Names'));
  if (!(namesDict instanceof PDFDict)) return;
  const embeddedFiles = namesDict.lookup(PDFName.of('EmbeddedFiles'));
  if (!(embeddedFiles instanceof PDFDict)) return;
  const names = embeddedFiles.lookup(PDFName.of('Names'));
  if (!(names instanceof PDFArray)) return;

  for (let i = names.size() - 2; i >= 0; i -= 2) {
    const nameObj = names.get(i);
    const name = nameObj instanceof PDFHexString || nameObj instanceof PDFString ? nameObj.decodeText() : '';
    if (name === targetFileName) {
      names.remove(i + 1);
      names.remove(i);
    }
  }
}

export async function extractSettingsFromPdf(
  pdfBytes: Uint8Array,
): Promise<CodexPdfSettings | null> {
  try {
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const catalog = pdfDoc.catalog;
    const namesDict = catalog.lookup(PDFName.of('Names'));
    if (!(namesDict instanceof PDFDict)) {
      return null;
    }

    const embeddedFiles = namesDict.lookup(PDFName.of('EmbeddedFiles'));
    if (!(embeddedFiles instanceof PDFDict)) {
      return null;
    }

    const jsonString = extractAttachmentContent(embeddedFiles, CODEX_PDF_SETTINGS_ATTACHMENT_NAME);
    if (!jsonString) {
      return null;
    }

    const parsed = JSON.parse(jsonString);
    if (isValidCodexPdfSettings(parsed)) {
      return normalizeSettings(parsed);
    }
    if (isLegacyCodexPdfSettings(parsed)) {
      return normalizeSettings(parsed);
    }
  } catch (error) {
    console.warn('Unable to extract Codex Musicae settings from PDF.', error);
  }

  return null;
}

function normalizeSettings(value: CodexPdfSettings | LegacyCodexPdfSettings): CodexPdfSettings {
  const candidate = value as LegacyCodexPdfSettings;
  return {
    version: 1,
    updatedAt: candidate.updatedAt,
    padding: candidate.padding,
    aspectRatio: candidate.aspectRatio ?? candidate.aspectRatioAdjustment ?? 0,
    musicSystems: candidate.musicSystems.map((musicSystem) => ({
      ...musicSystem,
      selectedPosition: musicSystem.selectedPosition ?? musicSystem.boxOrder,
    })),
  };
}

interface LegacyCodexPdfSettings {
  version: 1;
  updatedAt: string;
  padding: number;
  aspectRatio?: number;
  aspectRatioAdjustment?: number;
  musicSystems: Array<MusicSystem & { boxOrder?: number }>;
}

function isLegacyCodexPdfSettings(value: unknown): value is LegacyCodexPdfSettings {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return candidate['version'] === 1 && typeof candidate['padding'] === 'number' && Array.isArray(candidate['musicSystems']) &&
    (typeof candidate['aspectRatioAdjustment'] === 'number' || typeof candidate['aspectRatio'] === 'number');
}

function extractAttachmentContent(
  node: PDFDict,
  targetFileName: string,
): string | null {
  // Check Names array: [key, fileSpec, key, fileSpec, ...]
  const names = node.lookup(PDFName.of('Names'));
  if (names instanceof PDFArray) {
    for (let i = 0; i < names.size(); i += 2) {
      const nameObj = names.get(i);
      let nameStr = '';
      if (nameObj instanceof PDFHexString || nameObj instanceof PDFString) {
        nameStr = nameObj.decodeText();
      }

      if (nameStr === targetFileName) {
        const fileSpec = names.lookup(i + 1);
        if (fileSpec instanceof PDFDict) {
          return readFileSpecContent(fileSpec);
        }
      }
    }
  }

  // Check Kids if tree is branched
  const kids = node.lookup(PDFName.of('Kids'));
  if (kids instanceof PDFArray) {
    for (let i = 0; i < kids.size(); i++) {
      const child = kids.lookup(i);
      if (child instanceof PDFDict) {
        const result = extractAttachmentContent(child, targetFileName);
        if (result) return result;
      }
    }
  }

  return null;
}

function readFileSpecContent(fileSpec: PDFDict): string | null {
  const ef = fileSpec.lookup(PDFName.of('EF'));
  if (!(ef instanceof PDFDict)) return null;

  const stream = ef.lookup(PDFName.of('F')) || ef.lookup(PDFName.of('UF'));
  if (stream instanceof PDFRawStream) {
    const decodedStream = decodePDFRawStream(stream);
    const bytes = decodedStream.decode();
    return new TextDecoder().decode(bytes);
  }
  return null;
}
