/**
 * Feature switches of the NATIVE builds (EDN-006, R-22e): this file is the free native set.
 * The paid native build bundles the same file; the composition root forces every switch on (edition.ts, EDN-012).
 * Web-only switches (webOrganizational) are not in this file (EDN-009). Imported by the composition root only (EDN-007).
 */
export const FEATURES = {
  autosave: false, // Saves changes into the PDF automatically; paid only.
  saveCopy: false, // Save a copy / export of the PDF with notes; paid only.
  sendTo: false, // Send to other apps; paid only.
  recentFiles: false, // Remember and list recently opened files; paid only.
  sessionRestore: false, // Reopen the previous tabs at startup; paid only.
  persistSettings: false, // Store settings between runs; paid only.
  persistFileChoices: false, // Store per-file choices (view, playing order); paid only.
  restoreZoom: false, // Restore the zoom of a file when it is opened again; paid only.
  crossFileAutoOpen: false, // Open the next file of a set automatically at its end; paid only.
  shareIn: false, // Receive files shared from other apps; paid only.
};
