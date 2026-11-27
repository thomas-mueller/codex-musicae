/**
 * Feature switches of the WEB build (free edition, EDN-006, R-22e). Read only through the FEATURE_FLAGS token.
 * Every switch has a trailing comment: what it switches. Imported by the composition root only (EDN-007).
 * The web build stores nothing (R-8b): every persistence and save switch is off.
 */
export const FEATURES = {
  autosave: false, // Saves changes into the PDF automatically; off in the free edition.
  saveCopy: false, // Save as a new file (the PDF with notes, written elsewhere); off in the free edition.
  sendTo: false, // Send to other apps; off in the free edition.
  recentFiles: false, // Remember and list recently opened files; off on the web.
  sessionRestore: false, // Reopen the previous tabs at startup; off on the web.
  persistSettings: false, // Store settings between runs; off on the web.
  persistFileChoices: false, // Store per-file choices (view, playing order); off on the web.
  restoreZoom: false, // Restore the zoom of a file when it is opened again; off on the web.
  crossFileAutoOpen: false, // Open the next file of a set automatically at its end; off in the free edition.
  shareIn: false, // Receive files shared from other apps; off in the free edition.
  webOrganizational: false, // WEB ONLY (R-22l): organizational web pages (imprint, documentation, manual, advertisements).
};
