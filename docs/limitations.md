# Known limitations and future versions — CodexMusicae

## Known limitations (v1)

Accepted on purpose. They are not bugs; do not "fix" them in a v1 milestone.

- **LIM-001** Detection can fail on skewed, noisy or dark-bordered scans. Only the three levels help; there is no deskew or noise handling.
- **LIM-002** A scan with a page-sized frame produces two page-sized rectangles; only one is dropped, so the frame may be taken as a system.
- **LIM-003** A short last system narrower than `minSystemWidthRatio` is dropped (unless a finer level admits it).
- **LIM-004** Staves that are not joined by barlines become separate boxes.
- **LIM-005** Marks in the middle of a system (repeat signs, coda) cannot be represented; whole systems only.
- **LIM-006** No manual editing of detected boxes; the level is the only correction.
- **LIM-007** If embedded data is missing or stripped (for example by another PDF editor), detection reruns and manual jumps, breaks, stops and ratio overrides are lost.
- **LIM-008** Browsers other than Chromium cannot save in place; they offer "save a copy".
- **LIM-009** iPhone Safari has no Fullscreen API; only the app UI is hidden (installing as a home-screen PWA gets closer).
- **LIM-010** Chromium on the web needs one tap to re-grant file permission after a restart; other browsers need a re-pick.
- **LIM-011** Android in-place writing is a truncating write, not atomic; a crash during the write can corrupt the file. The in-memory state is kept for "save a copy".
- **LIM-012** External changes to an open file are not detected.
- **LIM-013** Saving rewrites the whole PDF in memory; very large scanned PDFs may fail to save. The app shows the error icon and keeps working.
- **LIM-014** Other viewers clip strokes at the page edge.
- **LIM-015** A slide ratio wider than the screen only shrinks the shown height; music size is capped by fitting the system width.
- **LIM-016** Pages without systems and systems that are never played cannot be annotated, because annotation mode shows only the playing order and organization mode has no drawing.
- **LIM-017** Encrypted PDFs are not supported.
- **LIM-018** Undo and redo cover strokes only; jumps, breaks and stops have delete only.
- **LIM-019** The eraser removes whole strokes, including ink made by other apps; it cannot erase parts of a stroke.
- **LIM-020** No page-rotation feature; pages with `/Rotate` display as stored. The screen orientation follows the OS.
- **LIM-021** The owner cannot test iOS Safari or iOS apps without a Mac; verification relies on Playwright WebKit and asynchronous testers. All iOS code is marked unverified.
- **LIM-022** Versions below 1.0.0 are pre-release milestones: they show progress, not stability, and early milestones deliver nothing usable. The release is the extra tag `v1.0.0` on the last included milestone's commit.
- **LIM-024** In a PDF whose `/EmbeddedFiles` name tree has `/Kids` nodes, the app's attachment is added as a new leaf without re-sorting the tree; strict viewers may not list it, other viewers ignore it either way.
- **LIM-025** Annotations of other apps that are not `/Ink` (text notes, highlights, stamps) are kept on save but not displayed by the app from M15 on.
- **LIM-026** A jump that starts at junction 0 or ends at junction N has no source or next system; its marker sits on the bar of that junction and the end at N shows no number (ORG-018, DEC-098).
- **LIM-027** A jump, slide break or stop that is never reached in the playing order has no playing-order numbers: it is listed at the end of the marks list, dimmed, with the placeholder `T:layout.unknownNumber` (ORG-018, ORG-021).
- **LIM-023** Samsung Internet is treated as covered by Chromium and verified on a real device only.

## Future versions (backlog)

Ideas not yet refined into requirements. To promote an item: create a requirement in `requirements.md` with a new ID and target `v2` (or `v1-optional`), mark the entry here `promoted → ID`, and log it in `changelog.md`.

- **BKL-001** Native iOS builds with the Apple Developer account, signed distribution (TestFlight or Firebase), App Store release (builds on M18).
- **BKL-002** Stylus pressure sensitivity (builds on M19).
- **BKL-003** Cross-PDF setlists (a setlist file referencing systems by PDF fingerprint and system ID).
- **BKL-004** ML-based system detection as a new `DetectionEngine`.
- **BKL-005** Deskew and noise handling for scans.
- **BKL-006** Manual editing of detected boxes (move, add, delete, merge, split).
- **BKL-007** Advanced view that exposes the raw detection parameters.
- **BKL-008** Persistent metadata backup keyed by file fingerprint, and an in-app library.
- **BKL-009** Global settings screen and key remapping for pedals.
- **BKL-010** Additional languages and a dark mode.
- **BKL-011** Per-pass slide breaks.
- **BKL-012** Undo and redo for jumps, breaks and stops.
- **BKL-013** Splitting a system in the middle of a line.
- **BKL-014** "Good place to turn" markers that guide slide packing.
- **BKL-015** Detection of external file changes while a file is open.
- **BKL-016** Annotation export and printing.
- **BKL-017** Text notes and stamps (dynamics, fingerings).
- **BKL-018** Page rotation.
- **BKL-019** First-run hints.
- **BKL-020** Crash reporting and analytics (opt-in).
- **BKL-021** Pull-request preview deployments.
- **BKL-022** Device-farm testing (for example Firebase Test Lab, BrowserStack).
- **BKL-023** Drawing in organization mode and annotating unplayed systems.
- **BKL-024** Password-protected PDFs.
- **LIM-028** Ink annotations that are direct dictionaries inside `/Annots` (not indirect objects) are not listed by `PdfWriter.listInk` because they have no object number to erase; with pdf.js annotations disabled they are not drawn by the app but stay in the file. Extremely rare in practice. (M15 S2)
