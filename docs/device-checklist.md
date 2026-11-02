# Device checklist

Manual tests that cannot be verified by the automated tests. Each item is **manual device test required** until the owner has run it and recorded the result here. M17 completes this list.

Result column: `todo` | `ok` | `fail (note)`.

## M16 S2 — Android immersive mode, keep awake, back button (PLT-005, PLT-006, PLT-007)

| # | Test | Req | Result |
|---|---|---|---|
| S2-1 | Enter presentation mode: status bar and navigation bar are hidden. | PLT-006 | todo |
| S2-2 | A swipe from a screen edge shows the bars transiently; they hide again by themselves. | PLT-006 | todo |
| S2-3 | On a device with a display cutout or rounded corners, the slide draws under the cutout; the progress line and the slide stay inside the bottom inset (`env(safe-area-inset-bottom)`). | PLT-006 | todo |
| S2-4 | Leave presentation mode: system bars are back, the layout is as before (no jump). | PLT-006 | todo |
| S2-5 | The screen stays on for 5 minutes without touch in presentation mode, and may time out normally after leaving it. | PLT-005 | todo |
| S2-6 | Open a system dialog (for example the share sheet or a permission prompt) from presentation mode and dismiss it: the bars are hidden again. | PLT-006 | todo |
| S2-7 | Back in presentation mode returns to annotation mode (the app stays open). | PLT-007 | todo |
| S2-8 | Back with a popup open closes the popup first. | PLT-007 | todo |
| S2-9 | Back in annotation mode with nothing open minimizes the app. | PLT-007 | todo |

PLT-006 and PLT-007 stay `todo` in `docs/requirements.md` until every item above is `ok`.

## M16 S3 — Android file access and "Open with"

Added when S3 is implemented.
