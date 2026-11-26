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
    appId: 'app.web.codexmusicaefree', // GEN-002, GEN-003, GEN-011: Capacitor appId, Android applicationId and iOS bundle ID of the FREE app
    appIdPaid: 'app.web.codexmusicae', // GEN-011: the same three IDs of the PAID app (the ID of V1)
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
      opacity: 0.3, // 0..1 alpha of an unselected bar
      selectedOpacity: 0.55, // 0..1 alpha of a selected bar
      provisionalOpacity: 0.12, // DET-021
      minHeightPx: 1, // ORG-008: a zero-height bar is drawn as a line this thick
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
    penPresets: ['#D32F2F', '#1565C0', '#2E7D32', '#EF6C00', '#6A1B9A', '#212121'], // ANN-004
    highlighterPresets: ['#FDD835', '#9CCC65', '#FFA726', '#F06292', '#4FC3F7', '#BA68C8'], // ANN-004
  },

  layout: {
    barHeightPx: 48, // UIX-007
    indicatorPlaceholder: '– / –', // UIX-004: shown instead of "x / n" while no document is open
    progressGapPx: 4, // DET-016: gap between the processing icon and the numbers
    progressSeparator: '/', // DET-016: between processed and total pages in the detection progress
    indicatorSeparator: ' / ', // ORG-004: between the current and the total page in "x / n"
    indicatorOpenSuffix: '+', // SLD-016: appended to n while detection is running ("x / n+")
    iconSizePx: 24, // UIX-010
    pageBadgeInsetPx: 6, // DET-016: distance of the per-page processing icon from the page's top-right corner
    tooltipPaddingPx: 8, // UIX-014
    tooltipRadiusPx: 4, // UIX-014
    popupAnimationMs: 150, // UIX-013: sheet slide-in
    popupRadiusPx: 12, // UIX-013
    fabInsetPx: 16, // UIX-004: distance of the tool button from the canvas edge
    minTouchTargetPx: 44, // UIX-007
    tabGapPx: 8, // FIL-003: padding inside a tab
    tabMaxWidthPx: 200, // FIL-004: a tab never grows beyond this; tabs share the free width equally and shrink together
    tabMinWidthPx: 44, // FIL-004: tabs shrink to this, then the tab bar shows the overflow button
    tabRadiusPx: 8, // FIL-004: rounded top corners
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
    numberSeparator: ', ', // ORG-012: between the playing-order numbers of a system
    systemLabelHeightRatio: 0.8, // ORG-012: the digits of a system's label cover this share of the system height
    systemLabelFontWeight: 200, // ORG-012: light, so the numbers do not dominate the page
    systemLabelDigitEm: 0.72, // ORG-012: height of a digit in em for the label font (sans-serif)
    barRowIconPx: 16, // ORG-011: break and stop icons in the bar row
    barRowInsetPx: 4, // ORG-011: left inset and gap between the items of a bar row
    breakLinePx: 2, // ORG-022: thickness of the slide-break line
    barHitSlopPx: 8, // ORG-013: extra tap area above and below a bar (thin bars stay tappable)
    chipGapPx: 8, // ORG-014: distance between the selection chip and its bar
    chipPaddingPx: 4, // ORG-014: padding inside the selection chip
    chipRadiusPx: 24, // ORG-014
    markerGapPx: 4, // ORG-018: gap between stacked jump markers and from the page edge
    markerPaddingPx: 3, // ORG-018: padding inside a jump marker
    markerRadiusPx: 8, // ORG-018
    markerFontPx: 11, // ORG-018
    passPrefix: '×', // ORG-018: before the pass number in a jump label ("4 → 5 ×2")
    hintBarHeightPx: 32, // ORG-015: slim hint bar while picking a jump target
    stepperGapPx: 8, // ORG-016: gap between the pass stepper's buttons and number
    jumpChipButtons: 3, // ORG-020: pass, change target, delete (also the width of the pass stepper: three parts)
    markListSwipeMinPx: 60, // ORG-021: horizontal distance of a swipe-left that deletes an entry of the marks list
    listArrow: '→', // ORG-018: between the previous and the next system number of a jump (markers and marks list)
    breakSeparator: '|', // ORG-021: between the previous and the next system number of a slide break in the marks list
    unknownNumber: '–', // ORG-018: shown where a mark has no number (not reached in the playing order, start or end of it)
    dotPx: 12, // ORG-021: diameter of the color dot of a jump in the marks list
    unreachedOpacity: 0.6, // ORG-021: entries that are never reached in the playing order are dimmed
    dialogRadiusPx: 12, // DET-014: confirmation dialog
    dialogGapPx: 8, // DET-014: gap between the level icon and the buttons
    markerRotationDeg: 180, // ORG-018: the split points toward the end of the PDF, the merge arrows come from its beginning
    markPanelWidthPx: 280, // ORG-021: width of the marks list beside its button (expanded layouts)
    markPanelMaxHeightVh: 70, // ORG-021: the marks list scrolls inside this share of the window height
    scrollbarGapPx: 20, // ORG-021: a panel on a right-hand strip keeps this distance so it never covers the scroll bar
    chipMaxButtons: 4, // ORG-014: jump, slide break, stop, delete (sizes the chip for its placement)
    settingsMaxWidthPx: 640, // UIX-026: the settings stay a readable column on wide screens
    settingsGapPx: 8, // UIX-026: padding and spacing in the settings view
  },

  /** Material Symbols (Outlined) names. The agent verifies each exists in the bundled set. UIX-010 */
  icons: {
    modeOrganization: 'description',
    modeAnnotation: 'draw',
    modePresentation: 'slideshow',
    settings: 'menu', // UIX-025: three lines
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
    jump: 'alt_route', // ORG-018: also the start marker of a jump, rotated by markerRotationDeg
    jumpEnd: 'merge', // ORG-018: the end marker of a jump (arrows merge), rotated by markerRotationDeg
    pass: 'counter_1', // ORG-020: chip button that opens the pass stepper
    changeTarget: 'ads_click', // ORG-020
    plus: 'add', // ORG-016
    minus: 'remove', // ORG-016
    slideBreak: 'content_cut',
    stop: 'stop_circle',
    delete: 'delete',
    levelSelector: 'tune',
    levelFast: 'bolt', // DET-013: one icon per detection level
    levelStandard: 'balance',
    levelFine: 'grain',
    markList: 'list', // ORG-021: button that opens the marks list (jumps, slide breaks, stops)
    overflow: 'more_vert',
    info: 'info',
    cancel: 'close',
    confirm: 'check', // DET-014: confirmation dialog
    fullscreen: 'fullscreen',
    fullscreenExit: 'fullscreen_exit',
    fingerDrawing: 'touch_app', // STY-003
    unsaved: 'circle', // FIL-003: unsaved dot
    needsReopen: 'sync_problem', // FIL-003: access lost, file must be opened again
    recentFiles: 'history', // FIL-008
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

  navigation: {
    pageScrollMs: 200, // ORG-005: duration of the previous/next page scroll (instant with reduced motion)
  },

  zoom: {
    min: 1, // 1 = fit scale (slide contained in canvas); organization mode: see ORG-003
    max: 4, // relative to the fit scale; NAV-014, ORG-003
    buttonStep: 1.25, // multiplicative step of zoom +/- buttons
    fitEpsilon: 1e-6, // NAV-009: zoom counts as zoomed above 1 + this
    orgDefault: 'fitPage' as 'fitWidth' | 'fitPage', // ORG-003: zoom on open and after reset; the minimum is always fit-page
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
     * Every level runs the same detection (adaptive mean threshold, 4-connected components, pixel areas, largest-gap area
     * threshold); the levels differ in resolution and in how narrow a system may be. DET-004..DET-009, DET-013
     * minSystemWidthRatio:  components narrower than this fraction of the page width are never systems
     * fullWidthSystemRatio: components at least this wide are always systems
     * renderScale:          bitmap pixels per PDF point used for detection (DET-003), written as dpi / 72
     * adaptiveBlockSize:    neighbourhood of the adaptive threshold in bitmap pixels (odd), scaled with the resolution
     * adaptiveC:            constant subtracted from the neighbourhood mean
     * `fast`: 100 dpi, ratios 0.5 / 0.75, block 31, C 15; the other levels scale resolution and block size up.
     */
    levels: {
      fast: { minSystemWidthRatio: 0.5, fullWidthSystemRatio: 0.75, renderScale: 100 / 72, adaptiveBlockSize: 31, adaptiveC: 15 }, // ratios 0..1 of the page width; scale in bitmap px per pt (100 dpi); block in bitmap px; C in gray levels
      standard: { minSystemWidthRatio: 0.5, fullWidthSystemRatio: 0.75, renderScale: 150 / 72, adaptiveBlockSize: 47, adaptiveC: 15 }, // same units as `fast`, 150 dpi
      fine: { minSystemWidthRatio: 0.4, fullWidthSystemRatio: 0.7, renderScale: 200 / 72, adaptiveBlockSize: 63, adaptiveC: 15 }, // same units as `fast`, 200 dpi
    },
    fallbackPaddingPageHeightRatio: 0.02, // DET-010: used when no spacing exists in the whole document
    retryScaleFactor: 0.6, // DET-018
    idleBeforeResumeMs: 1000, // DET-017
    pauseWhenHidden: true, // DET-017
    pauseOnBatterySaver: true, // DET-017 (where detectable)
    cancelRetryDelayMs: 250, // DET-017: wait before a page cancelled by foreground work is submitted again
    opencvAssetPath: 'assets/opencv/opencv.js', // NFR-012: self-hosted, loaded only inside the detection worker
    adaptiveMaxValue: 255, // DET-004: ink value in the binary image
    connectivity: 4, // DET-004: 4-connected components
    ccStat: { left: 0, top: 1, width: 2, height: 3, area: 4 }, // DET-004: cv.CC_STAT_* columns of connectedComponentsWithStats
  },

  playingOrder: {
    maxLength: 20000, // PLY-005 safety cap (jumps are finite by design)
  },

  annotation: {
    penWidthsPt: [0.5, 1, 2], // ANN-004
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
    schemaVersion: 2, // SAV-002, SAV-015
  },

  /** SAV-006, SAV-010: how ink and the metadata attachment are written into the PDF (adapters/pdflib). */
  pdfWriter: {
    author: 'CodexMusicae', // /T of every ink annotation we write
    annotationFlags: 4, // /F: print
    bboxPaddingPt: 1, // added to half the stroke width around the stroke bounds
    defaultInkColor: '#000000', // annotations without /C
    defaultInkWidthPt: 1, // annotations without /BS and /Border
    numberDecimals: 4, // fixed-point digits in content streams and arrays
    colorByteMax: 255, // largest value of one 8-bit color channel
    hexRadix: 16, // base of a hex color digit
    hexDigitsPerChannel: 2, // hex digits per color channel in #RRGGBB
    grayComponents: 1,
    rgbComponents: 3, // numbers in an RGB color array
    cmykComponents: 4, // numbers in a CMYK color array
    borderWidthIndex: 2, // /Border [h v width]
    embeddedFileDescription: 'CodexMusicae metadata', // SAV-001
    embeddedFileMime: 'application/json',
  },

  resources: {
    cacheBudgetDefaultBytes: 96 * 1024 * 1024, // NFR-004
    cacheBudgetByDeviceMemoryGb: {
      1: 48 * 1024 * 1024, // bytes of cache on a device with 1 GB
      2: 96 * 1024 * 1024, // bytes on 2 GB
      4: 192 * 1024 * 1024, // bytes on 4 GB
      8: 320 * 1024 * 1024, // bytes on 8 GB or more
    }, // NFR-004 (navigator.deviceMemory buckets)
    devicePixelRatioCap: 2, // NFR-005
    maxCanvasPixels: 12_000_000, // NFR-006 (also protects iOS/WebKit canvas limits)
    tileSizePx: 1024, // NFR-007
    prefetchNeighbors: 1, // NFR-003, NFR-004
    prefetchBudgetShare: 0.8, // NFR-027: fraction of the bitmap cache budget that the current slide and its prefetched neighbors may fill; the rest is for older entries, tiles and other tabs
    recentFilesMax: 20, // FIL-008
    orgRenderPagesAround: 1, // ORG-002
    fileChunkBytes: 2 * 1024 * 1024, // PLT-008: chunk size for file transfer between the Android plugin and the WebView
    governorEscalateCooldownMs: 2000, // NFR-010: minimum time between two escalation steps
    governorRecoverMs: 60000, // NFR-010: quiet time after which the governor steps back one level
    governorLowResFactor: 0.75, // NFR-010: render scale factor at level 2 and above
    governorMaxLevel: 3, // NFR-010: 0 = normal … 3 = inactive tabs' bitmaps freed
    schedulerMaxPerClass: 1, // NFR-003: running tasks per priority class
    workingLongSidePx: 3600, // NFR-025: long side in pixels of the working raster of a page; views up to this scale never decode the source images
    workingPagesKept: 3, // NFR-025: working rasters kept per document (about 40 MB each at the canvas cap)
    sourceDecodeSlots: 1, // NFR-025: source renders (pdf.js decodes the page's images) running at once per document
    rasterProbeSize: 32, // NFR-028: px (square) of the small copy of a finished working raster that is read back to check it
    rasterMinAlpha: 250, // NFR-028: alpha (0..255) below which a probe pixel counts as transparent; a rendered page is opaque, a dropped canvas is not
    rasterFlatTolerance: 2, // NFR-028: gray levels per channel within which the probe counts as one flat colour
    rasterLostRetries: 2, // NFR-028: rebuilds of a working raster that came back transparent before the build fails with out-of-memory
    rasterRetryDelayMs: 300, // NFR-028 (ms): wait before a rebuild of a lost raster, times the number of the rebuild
  },

  files: {
    handleDbName: 'cm-files', // FIL-015: IndexedDB database for web file handles
    handleStoreName: 'handles', // FIL-015
    handleDbVersion: 1, // FIL-015
    pdfMimeType: 'application/pdf', // FIL-001
    pdfExtension: '.pdf', // FIL-001
    copySuffix: ' (annotated)', // SAV-011: "<name> (annotated).pdf"
    writeChunkBytes: 4 * 1024 * 1024, // NFR-013: large writes go out in chunks
  },

  platforms: {
    android: 'android', // PLT-007, PLT-013: the only Capacitor platform with a system back button
  },

  ios: {
    deploymentTarget: '16.4', // PLT-012: the one iOS version the project targets (pbxproj, all four build configurations)
    pdfContentType: 'com.adobe.pdf', // PLT-012: Info.plist document type
    pdfTypeRole: 'Editor', // PLT-012: the app saves back into the file
    pdfHandlerRank: 'Alternate', // PLT-012: offered next to other PDF apps, never the default
    iconPixels: 1024, // PLT-012: placeholder app icon edge
    splashPixels: 2732, // PLT-012: placeholder launch image edge
    splashIconRatio: 0.25, // PLT-012: icon edge relative to the launch image edge
  },

  pdf: {
    workerSrc: 'assets/pdfjs/pdf.worker.min.mjs', // GEN-005: pdf.js worker from our own origin, no CDN
    cMapUrl: 'assets/pdfjs/cmaps/', // GEN-005
    standardFontDataUrl: 'assets/pdfjs/standard_fonts/', // GEN-005
    wasmUrl: 'assets/pdfjs/wasm/', // GEN-005
    iccUrl: 'assets/pdfjs/iccs/', // GEN-005
    annotationModeDisable: 0, // SAV-006: pdf.js AnnotationMode.DISABLE; the app draws every stroke itself
    sourceImageMaxBytes: 16_000_000 * 4, // NFR-025: bytes (4 per pixel) a decoded source image may use; pdf.js shrinks larger images in its worker before they reach the page
    warmPagesByDeviceMemoryGb: {
      1: 1, // pages whose pdf.js state (parsed content, decoded images) stays warm on a device with 1 GB
      2: 1, // pages on 2 GB
      4: 2, // pages on 4 GB
      8: 3, // pages on 8 GB or more
    }, // NFR-026 (navigator.deviceMemory buckets)
    warmPagesDefault: 2, // NFR-026: pages kept warm when the device memory is unknown
  },

  rendering: {
    zoomSettleMs: 200, // SLD-018, ORG-002: wait after the last zoom change before re-rendering sharp
    orgPageGapPx: 12, // ORG-001: gap between pages in organization mode
    tileRetryMax: 3, // NFR-008: resubmissions of a tile whose task was cancelled by a higher-priority task
  },

  budgets: {
    slideChangeP95Ms: 200, // NFR-001
    drawingMaxLongTaskMs: 2000, // NFR-002 (ms): longest main-thread task; measured 189 ms (21 pages) and 161 to 1654 ms (281 pages, loaded machine) on real scans while detection runs; raised from 400 by owner decision, V2-M2 2026-11-22
    drawingMaxAddedLatencyMs: 16, // NFR-002
    initialBundleKbGzip: 600, // NFR-014
    ciToleranceFactor: 2, // TST-008: performance tests allow this factor on CI machines
    maxJsHeapMb: 400, // NFR-016: JS heap after opening and using the reference PDF (Chromium measurement)
    openToFirstSlideMs: 8000, // NFR-016: reference PDF opened until the first slide is drawn (detection may continue)
  },

  persistence: {
    keyPrefix: 'cm.v1.', // FIL-015 (Preferences store: UI state and file references only)
    sessionDebounceMs: 500, // FIL-011: delay before the session snapshot is written
    sessionKey: 'session', // FIL-011: preference key of the session snapshot
    // EDN-005: which feature switch (config/features.*.ts) guards a preference key; a key is matched by `name` or `name.` prefix.
    switchByKeyPrefix: {
      recent: 'recentFiles', // EDN-005: the list of recent files
      session: 'sessionRestore', // EDN-005: the session snapshot (open tabs and positions)
    },
    defaultKeySwitch: 'persistSettings', // EDN-005: every other preference key (tool settings, stylus, aspect ratios) is a setting
  },

  testing: {
    unitTestTimeoutMs: 10_000, // TST-008 (ms): Vitest timeout for tests and hooks; real-PDF specs are heavy in the parallel run (Vitest default 5000)
  },

  stylus: {
    // v1-optional (M19)
    palmRejectionGraceMs: 300, // STY-004
    allowFingerDrawingDefault: false, // STY-003
  },
} as const;

export type DetectionLevelName = keyof typeof TUNABLES.detection.levels;
