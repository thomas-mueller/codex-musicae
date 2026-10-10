import { Injectable, signal } from '@angular/core';
import type { CV } from '@techstark/opencv-js';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import type { MusicSystem } from './music-system.model';
import { PDF_DETECTION_CONFIG } from './pdf-detection.config';

export const MUSIC_SYSTEM_DETECTION_SCALE = PDF_DETECTION_CONFIG.renderScale;
let openCvPromise: Promise<CV> | undefined;

export interface MusicSystemDetectionOptions {
  signal?: AbortSignal;
  initialPage?: number;
  onPageDetected?: (musicSystems: readonly MusicSystem[], pageNumber: number) => void;
  onPageMetrics?: (metrics: MusicSystemDetectionMetrics) => void;
}

export interface MusicSystemDetectionMetrics {
  page: number;
  renderMs: number;
  processingMs: number;
  canvasWidth: number;
  canvasHeight: number;
}

export function shouldSelectConnectedComponent(
  area: number,
  width: number,
  canvasWidth: number,
  selectionThreshold: number,
): boolean {
  const widthRatio = width / canvasWidth;
  if (widthRatio < PDF_DETECTION_CONFIG.minimumBoxWidthRatio) return false;
  return widthRatio >= PDF_DETECTION_CONFIG.forcedSelectionWidthRatio || area > selectionThreshold;
}

interface DetectionCache {
  pages: Map<number, readonly MusicSystem[]>;
}

interface DetectedPage {
  musicSystems: MusicSystem[];
  renderMs: number;
  processingMs: number;
}

@Injectable({ providedIn: 'root' })
export class MusicSystemService {
  readonly musicSystems = signal<readonly MusicSystem[]>([]);
  readonly padding = signal(0.025);
  readonly hasEditorState = signal(false);
  private readonly detectionCache = new WeakMap<PDFDocumentProxy, DetectionCache>();
  private detectionCanvas?: HTMLCanvasElement;

  async detectMusicSystemsInDocument(
    documentProxy: PDFDocumentProxy,
    options: MusicSystemDetectionOptions = {},
  ): Promise<MusicSystem[]> {
    const cache = this.detectionCache.get(documentProxy) ?? { pages: new Map() };
    this.detectionCache.set(documentProxy, cache);
    const musicSystems: MusicSystem[] = [];
    const initialPage = Math.max(1, Math.min(documentProxy.numPages, options.initialPage ?? 1));
    const pageOrder = [initialPage, ...Array.from({ length: documentProxy.numPages }, (_, index) => index + 1)
      .filter((page) => page !== initialPage)];

    for (const page of pageOrder) {
      this.throwIfAborted(options.signal);
      const cached = cache.pages.get(page);
      if (cached) {
        musicSystems.push(...cached);
        options.onPageDetected?.(cached, page);
        continue;
      }

      const pdfPage = await documentProxy.getPage(page);
      this.throwIfAborted(options.signal);
      const detected = await this.detectMusicSystemsOnPage(pdfPage, page, options.signal);
      cache.pages.set(page, detected.musicSystems);
      musicSystems.push(...detected.musicSystems);
      options.onPageDetected?.(detected.musicSystems, page);
      options.onPageMetrics?.({
        page,
        renderMs: detected.renderMs,
        processingMs: detected.processingMs,
        canvasWidth: this.detectionCanvas?.width ?? 0,
        canvasHeight: this.detectionCanvas?.height ?? 0,
      });
      await this.yieldToBrowser(options.signal);
    }
    return musicSystems;
  }

  setEditorState(musicSystems: readonly MusicSystem[], padding: number): void {
    this.musicSystems.set(musicSystems.map((musicSystem) => ({ ...musicSystem })));
    this.padding.set(padding);
    this.hasEditorState.set(true);
  }

  clearEditorState(): void {
    this.musicSystems.set([]);
    this.hasEditorState.set(false);
  }

  private async detectMusicSystemsOnPage(
    page: PDFPageProxy,
    pageNumber: number,
    signal?: AbortSignal,
  ): Promise<DetectedPage> {
    this.throwIfAborted(signal);
    const cv = await this.getOpenCv();
    this.throwIfAborted(signal);
    const viewport = page.getViewport({ scale: MUSIC_SYSTEM_DETECTION_SCALE });
    const canvas = this.detectionCanvas ??= document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas rendering is unavailable for music-system detection.');
    const renderStartedAt = performance.now();
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    const renderMs = performance.now() - renderStartedAt;
    this.throwIfAborted(signal);

    let source: InstanceType<CV['Mat']> | undefined;
    let gray: InstanceType<CV['Mat']> | undefined;
    let binary: InstanceType<CV['Mat']> | undefined;
    let labels: InstanceType<CV['Mat']> | undefined;
    let stats: InstanceType<CV['Mat']> | undefined;
    let centroids: InstanceType<CV['Mat']> | undefined;
    try {
      const processingStartedAt = performance.now();
      source = cv.imread(canvas); gray = new cv.Mat(); cv.cvtColor(source, gray, cv.COLOR_RGBA2GRAY);
      this.throwIfAborted(signal);
      binary = new cv.Mat();
      cv.adaptiveThreshold(gray, binary, 255, cv.ADAPTIVE_THRESH_MEAN_C, cv.THRESH_BINARY_INV, 31, 15);
      this.throwIfAborted(signal);
      labels = new cv.Mat(); stats = new cv.Mat(); centroids = new cv.Mat();
      cv.connectedComponentsWithStats(binary, labels, stats, centroids, 4, cv.CV_32S);
      const areas: number[] = [];
      for (let row = 1; row < stats.rows; row += 1) areas.push(stats.intAt(row, cv.CC_STAT_AREA));
      areas.sort((a, b) => b - a);
      if (!areas.length) {
        return { musicSystems: [], renderMs, processingMs: performance.now() - processingStartedAt };
      }
      let largestGapIndex = 0; let largestGap = -1;
      for (let i = 0; i < areas.length - 1; i += 1) {
        const gap = areas[i] - areas[i + 1];
        if (gap > largestGap) { largestGap = gap; largestGapIndex = i + 1; }
      }
      const selectionThreshold = areas.length === 1 ? 0 : areas[largestGapIndex];
      const musicSystems: MusicSystem[] = [];
      for (let row = 1; row < stats.rows; row += 1) {
        const x = stats.intAt(row, cv.CC_STAT_LEFT); const y = stats.intAt(row, cv.CC_STAT_TOP);
        const width = stats.intAt(row, cv.CC_STAT_WIDTH); const height = stats.intAt(row, cv.CC_STAT_HEIGHT);
        if (!shouldSelectConnectedComponent(
          stats.intAt(row, cv.CC_STAT_AREA),
          width,
          canvas.width,
          selectionThreshold,
        )) continue;
        musicSystems.push({ page: pageNumber, xMin: x / canvas.width, yMin: y / canvas.height, xMax: (x + width) / canvas.width, yMax: (y + height) / canvas.height });
      }
      return { musicSystems, renderMs, processingMs: performance.now() - processingStartedAt };
    } finally {
      source?.delete(); gray?.delete(); binary?.delete(); labels?.delete(); stats?.delete(); centroids?.delete();
    }
  }

  private throwIfAborted(signal?: AbortSignal): void {
    if (signal?.aborted) {
      throw new DOMException('Music-system detection was cancelled.', 'AbortError');
    }
  }

  private async yieldToBrowser(signal?: AbortSignal): Promise<void> {
    this.throwIfAborted(signal);
    await new Promise<void>((resolve) => {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => resolve());
      } else {
        setTimeout(resolve, 0);
      }
    });
    this.throwIfAborted(signal);
  }

  private getOpenCv(): Promise<CV> {
    if (!openCvPromise) {
      const root = globalThis as typeof globalThis & { cv?: unknown };
      const loadScript = root.cv ? Promise.resolve() : new Promise<void>((resolve, reject) => {
        const script = document.createElement('script'); script.src = '/assets/opencv/opencv.js'; script.async = true;
        script.onload = () => resolve(); script.onerror = () => reject(new Error('Unable to load OpenCV.')); document.head.appendChild(script);
      });
      openCvPromise = loadScript.then(async () => {
        let module = root.cv as (CV & { onRuntimeInitialized?: () => void }) | Promise<CV>;
        if (module instanceof Promise) module = await module;
        if (module.Mat) return module;
        return new Promise<CV>((resolve) => { module.onRuntimeInitialized = () => resolve(module as CV); });
      });
    }
    return openCvPromise;
  }
}

