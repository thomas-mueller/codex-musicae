/**
 * CodexMusicae tunables.
 *
 * ONE place for every number, color, icon name and key binding.
 * Rule: no magic numbers or colors elsewhere in the code base.
 * Comments name the requirement IDs (docs/requirements.md) that use a value.
 * Units: px = CSS pixels, pt = PDF points (1/72 inch), ms = milliseconds.
 */
export const TUNABLES = {
  identity: {
    appName: 'CodexMusicae', // GEN-001
    appId: 'app.web.codexmusicae', // GEN-002, GEN-003
  },

  colors: {
    canvasGrey: '#B0B4BA', // GEN-008: background around/behind PDF content and filler
    overlayOpacity: 0.7, // SLD-009: opacity of canvasGrey overlay on dimmed filler
    paper: '#FFFFFF',
    accent: '#1A73E8', // UIX-011
    onAccent: '#FFFFFF',
    iconDefault: '#202124',
    barBackground: '#F1F3F4', // UIX-007
    progressLine: '#2E9E4F', // UIX-020
    breakLine: '#D32F2F', // ORG-022
    orgBar: {
      tint: '#00897B', // ORG-010
      opacity: 0.3,
      selectedOpacity: 0.55,
      provisionalOpacity: 0.12, // DET-021
    },
    jumpPalette: [
      '#E53935',
      '#8E24AA',
      '#3949AB',
      '#039BE5',
      '#00897B',
      '#7CB342',
      '#FB8C00',
      '#6D4C41',
    ], // ORG-018: colors are assigned cyclically by jump id
    penPresets: ['#D32F2F', '#1565C0', '#2E7D32', '#EF6C00', '#6A1B9A'], // ANN-004
    highlighterPresets: ['#FDD835', '#9CCC65', '#FFA726', '#F06292', '#4FC3F7', '#BA68C8'], // ANN-004
  },

  layout: {
    barHeightPx: 48, // UIX-007
    indicatorPlaceholder: '– / –', // UIX-004: shown instead of "x / n" while no document is open
    iconSizePx: 24, // UIX-010
    tooltipPaddingPx: 8, // UIX-014
    tooltipRadiusPx: 4, // UIX-014
    popupAnimationMs: 150, // UIX-013: sheet slide-in
    popupRadiusPx: 12, // UIX-013
    fabInsetPx: 16, // UIX-004: distance of the tool button from the canvas edge
    minTouchTargetPx: 44, // UIX-007
    compactMaxWidthPx: 600, // UIX-003: compact if width < this ...
    compactMaxHeightPx: 480, // ... or height < this
    toolStripSide: 'left' as 'left' | 'right', // UIX-005
    disabledOpacity: 0.38, // UIX-012
    tooltipHoverDelayMs: 600, // UIX-014
    longPressMs: 500, // UIX-014, ORG-019, ANN-002
    cursorHideMs: 2000, // UIX-019
    progressLineHeightPx: 3, // UIX-020
    minSupportedWidthPx: 320, // UIX-016
    maxSupportedWidthPx: 2560, // UIX-016
  },

  /** Material Symbols (Outlined) names. The agent verifies each exists in the bundled set. UIX-010 */
  icons: {
    modeOrganization: 'description',
    modeAnnotation: 'draw',
    modePresentation: 'slideshow',
    pen: 'edit',
    highlighter: 'ink_highlighter',
    eraser: 'ink_eraser',
    undo: 'undo',
    redo: 'redo',
    openFile: 'folder_open',
    closeTab: 'close',
    save: 'save',
    saveCopy: 'file_download',
    readOnly: 'lock',
    error: 'error',
    processing: 'sync',
    zoomIn: 'zoom_in',
    zoomOut: 'zoom_out',
    zoomReset: 'fit_screen',
    previous: 'chevron_left',
    next: 'chevron_right',
    showMore: 'unfold_more', // taller slide = lower aspect ratio
    showLess: 'unfold_less', // wider slide = higher aspect ratio
    jump: 'alt_route',
    slideBreak: 'content_cut',
    stop: 'stop_circle',
    delete: 'delete',
    levelSelector: 'tune',
    levelFast: 'bolt', // DET-013: one icon per detection level
    levelStandard: 'balance',
    levelFine: 'grain',
    jumpList: 'list',
    overflow: 'more_vert',
    info: 'info',
    cancel: 'close',
    fullscreen: 'fullscreen',
    fullscreenExit: 'fullscreen_exit',
    fingerDrawing: 'touch_app', // STY-003
  },

  gestures: {
    tapMaxDurationMs: 250, // NAV-007
    tapMaxMovePx: 10, // NAV-007
    doubleTapMaxIntervalMs: 300, // NAV-016
    doubleTapMaxDistancePx: 30, // NAV-016
    doubleTapZoomFactor: 2, // NAV-016
    tapZones: { left: 0.3, center: 0.4, right: 0.3 }, // NAV-006 (fractions of viewport width, sum = 1)
    swipeMinDistanceFraction: 0.15, // NAV-008 (of viewport width)
    swipeMaxAngleDeg: 30, // NAV-008 (from horizontal)
    swipeMinVelocityPxPerMs: 0.3, // NAV-008
    wheel: {
      stepThresholdPx: 60, // NAV-011
      idleResetMs: 150, // NAV-011
      cooldownMs: 350, // NAV-011
      lineHeightPx: 40, // NAV-011 (deltaMode = lines)
      pageHeightPx: 800, // NAV-011 (deltaMode = pages)
      zoomSensitivity: 0.002, // NAV-013 (zoom factor = exp(-deltaY * this))
    },
    allowKeyRepeat: false, // NAV-004
  },

  /** KeyboardEvent.code values, optional "Shift+" prefix. NAV-002 */
  keymap: {
    next: ['PageDown', 'ArrowRight', 'ArrowDown', 'Space'],
    previous: ['PageUp', 'ArrowLeft', 'ArrowUp', 'Shift+Space'],
    first: ['Home'],
    last: ['End'],
    back: ['Escape'],
  },

  zoom: {
    min: 1, // 1 = fit scale (slide contained in canvas); organization mode: see ORG-003
    max: 4, // relative to the fit scale; NAV-014, ORG-003
    buttonStep: 1.25, // multiplicative step of zoom +/- buttons
    orgDefault: 'fitWidth' as 'fitWidth' | 'fitPage', // ORG-003
  },

  aspectRatio: {
    min: 0.5, // SLD-013
    max: 2.0, // SLD-013
    step: 0.1, // SLD-013
    roundDecimals: 2, // SLD-014
  },

  detection: {
    defaultLevel: 'fast' as 'fast' | 'standard' | 'fine', // DET-013
    /**
     * Each level is a fixed set of three named parameters. DET-013
     * minSystemWidthRatio:  rects narrower than this fraction of page width are never systems (DET-007)
     * fullWidthSystemRatio: rects at least this wide are always systems (DET-008)
     * renderScale:          bitmap pixels per PDF point used for detection (DET-003)
     */
    levels: {
      fast: { minSystemWidthRatio: 0.6, fullWidthSystemRatio: 0.8, renderScale: 1.0 },
      standard: { minSystemWidthRatio: 0.5, fullWidthSystemRatio: 0.75, renderScale: 1.5 },
      fine: { minSystemWidthRatio: 0.4, fullWidthSystemRatio: 0.7, renderScale: 2.5 },
    },
    fallbackPaddingPageHeightRatio: 0.02, // DET-010: used when no spacing exists in the whole document
    retryScaleFactor: 0.6, // DET-018
    idleBeforeResumeMs: 1000, // DET-017
    pauseWhenHidden: true, // DET-017
    pauseOnBatterySaver: true, // DET-017 (where detectable)
  },

  playingOrder: {
    maxLength: 20000, // PLY-005 safety cap (jumps are finite by design)
  },

  annotation: {
    penWidthsPt: [1, 2.5, 5], // ANN-004
    highlighterWidthsPt: [8, 14, 22], // ANN-004
    defaultPen: { color: '#D32F2F', widthIndex: 1 }, // ANN-003
    defaultHighlighter: { color: '#FDD835', widthIndex: 1 }, // ANN-003
    highlighterOpacity: 0.35, // ANN-004
    eraserHitRadiusPx: 8, // ANN-005
    simplifyEpsilonPt: 0.3, // ANN-011 (Ramer-Douglas-Peucker)
    undoDepth: 200, // ANN-006
  },

  saving: {
    autosaveIdleMs: 3000, // SAV-008
    metadataFileName: 'codexmusicae.json', // SAV-001
    schemaVersion: 1, // SAV-002
  },

  resources: {
    cacheBudgetDefaultBytes: 96 * 1024 * 1024, // NFR-004
    cacheBudgetByDeviceMemoryGb: {
      1: 48 * 1024 * 1024,
      2: 96 * 1024 * 1024,
      4: 192 * 1024 * 1024,
      8: 320 * 1024 * 1024,
    }, // NFR-004 (navigator.deviceMemory buckets)
    devicePixelRatioCap: 2, // NFR-005
    maxCanvasPixels: 12_000_000, // NFR-006 (also protects iOS/WebKit canvas limits)
    tileSizePx: 1024, // NFR-007
    prefetchNeighbors: 1, // NFR-003, NFR-004
    recentFilesMax: 20, // FIL-008
    orgRenderPagesAround: 1, // ORG-002
    fileChunkBytes: 2 * 1024 * 1024, // PLT-008: chunk size for file transfer between the Android plugin and the WebView
    governorEscalateCooldownMs: 2000, // NFR-010: minimum time between two escalation steps
    governorRecoverMs: 60000, // NFR-010: quiet time after which the governor steps back one level
    governorLowResFactor: 0.75, // NFR-010: render scale factor at level 2 and above
  },

  files: {
    handleDbName: 'cm-files', // FIL-015: IndexedDB database for web file handles
    handleStoreName: 'handles', // FIL-015
    handleDbVersion: 1, // FIL-015
    pdfMimeType: 'application/pdf', // FIL-001
    pdfExtension: '.pdf', // FIL-001
  },

  pdf: {
    workerSrc: 'assets/pdfjs/pdf.worker.min.mjs', // GEN-005: pdf.js worker from our own origin, no CDN
    cMapUrl: 'assets/pdfjs/cmaps/', // GEN-005
    standardFontDataUrl: 'assets/pdfjs/standard_fonts/', // GEN-005
    wasmUrl: 'assets/pdfjs/wasm/', // GEN-005
    iccUrl: 'assets/pdfjs/iccs/', // GEN-005
  },

  rendering: {
    zoomSettleMs: 200, // SLD-018, ORG-002: wait after the last zoom change before re-rendering sharp
    orgPageGapPx: 12, // ORG-001: gap between pages in organization mode
  },

  budgets: {
    slideChangeP95Ms: 200, // NFR-001
    drawingMaxLongTaskMs: 50, // NFR-002
    drawingMaxAddedLatencyMs: 16, // NFR-002
    initialBundleKbGzip: 600, // NFR-014
    ciToleranceFactor: 2, // TST-008: performance tests allow this factor on CI machines
    maxJsHeapMb: 400, // NFR-016: JS heap after opening and using the reference PDF (Chromium measurement)
    openToFirstSlideMs: 8000, // NFR-016: reference PDF opened until the first slide is drawn (detection may continue)
  },

  persistence: {
    keyPrefix: 'cm.v1.', // FIL-015 (Preferences store: UI state and file references only)
    sessionDebounceMs: 500, // FIL-011: delay before the session snapshot is written
  },

  stylus: {
    // v1-optional (M19)
    palmRejectionGraceMs: 300, // STY-004
    allowFingerDrawingDefault: false, // STY-003
  },
} as const;

export type Tunables = typeof TUNABLES;
export type DetectionLevelName = keyof typeof TUNABLES.detection.levels;
export type CommandName = keyof typeof TUNABLES.keymap;
