import { Injectable, signal } from '@angular/core';
import type { CV } from '@techstark/opencv-js';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import type { MusicSystem } from './music-system.model';

const DETECTION_SCALE = 300 / 72;
let openCvPromise: Promise<CV> | undefined;

@Injectable({ providedIn: 'root' })
export class MusicSystemService {
  readonly musicSystems = signal<readonly MusicSystem[]>([]);
  readonly padding = signal(0.025);
  readonly hasEditorState = signal(false);

  async detectMusicSystemsInDocument(documentProxy: PDFDocumentProxy): Promise<MusicSystem[]> {
    const musicSystems: MusicSystem[] = [];
    for (let page = 1; page <= documentProxy.numPages; page += 1) {
      const pdfPage = await documentProxy.getPage(page);
      musicSystems.push(...(await this.detectMusicSystemsOnPage(pdfPage, page)));
    }
    return musicSystems;
  }

  setEditorState(musicSystems: readonly MusicSystem[], padding: number): void {
    this.musicSystems.set(musicSystems.map((musicSystem) => ({ ...musicSystem })));
    this.padding.set(padding);
    this.hasEditorState.set(true);
  }

  private async detectMusicSystemsOnPage(page: PDFPageProxy, pageNumber: number): Promise<MusicSystem[]> {
    const cv = await this.getOpenCv();
    const viewport = page.getViewport({ scale: DETECTION_SCALE });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas rendering is unavailable for music-system detection.');
    await page.render({ canvas, canvasContext: context, viewport }).promise;

    let source: InstanceType<CV['Mat']> | undefined;
    let gray: InstanceType<CV['Mat']> | undefined;
    let binary: InstanceType<CV['Mat']> | undefined;
    let labels: InstanceType<CV['Mat']> | undefined;
    let stats: InstanceType<CV['Mat']> | undefined;
    let centroids: InstanceType<CV['Mat']> | undefined;
    try {
      source = cv.imread(canvas); gray = new cv.Mat(); cv.cvtColor(source, gray, cv.COLOR_RGBA2GRAY);
      binary = new cv.Mat();
      cv.adaptiveThreshold(gray, binary, 255, cv.ADAPTIVE_THRESH_MEAN_C, cv.THRESH_BINARY_INV, 31, 15);
      labels = new cv.Mat(); stats = new cv.Mat(); centroids = new cv.Mat();
      cv.connectedComponentsWithStats(binary, labels, stats, centroids, 4, cv.CV_32S);
      const areas: number[] = [];
      for (let row = 1; row < stats.rows; row += 1) areas.push(stats.intAt(row, cv.CC_STAT_AREA));
      areas.sort((a, b) => b - a);
      if (!areas.length) return [];
      let largestGapIndex = 0; let largestGap = -1;
      for (let i = 0; i < areas.length - 1; i += 1) {
        const gap = areas[i] - areas[i + 1];
        if (gap > largestGap) { largestGap = gap; largestGapIndex = i + 1; }
      }
      const selectionThreshold = areas.length === 1 ? 0 : areas[largestGapIndex];
      const musicSystems: MusicSystem[] = [];
      for (let row = 1; row < stats.rows; row += 1) {
        if (stats.intAt(row, cv.CC_STAT_AREA) <= selectionThreshold) continue;
        const x = stats.intAt(row, cv.CC_STAT_LEFT); const y = stats.intAt(row, cv.CC_STAT_TOP);
        const width = stats.intAt(row, cv.CC_STAT_WIDTH); const height = stats.intAt(row, cv.CC_STAT_HEIGHT);
        musicSystems.push({ page: pageNumber, xMin: x / canvas.width, yMin: y / canvas.height, xMax: (x + width) / canvas.width, yMax: (y + height) / canvas.height });
      }
      return musicSystems;
    } finally {
      source?.delete(); gray?.delete(); binary?.delete(); labels?.delete(); stats?.delete(); centroids?.delete();
    }
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
