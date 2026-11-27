# Icons

How the app's control icons work and how to change one. App and store branding icons (`public/`, `android/`, `docs/branding/`) are not covered here.

## Where they live

| What | Where |
|---|---|
| Icon key → Material Symbols (Outlined) name | `icons` in `src/config/tunables.ts` (`T:icons`) |
| The SVG sources | the npm package `@material-symbols/svg-400` |
| Builder, with `aliases` for names the package ships under another file name | `scripts/build-icons.mjs` |
| The generated sprite (committed, never edited by hand) | `src/assets/icons/sprite.svg` |
| Loading: once at the app start into the page, ids prefixed with `T:iconSprite.idPrefix` | `src/app/adapters/web/icon-sprite.ts` (why: DEC-161) |
| The only component that draws an icon | `src/app/features/shell/icon.ts` (`app-icon`) |
| Icon-only buttons with label and tooltip | `src/app/features/shell/icon-button.ts` |

Code names icons by their **key** (`undo`), never by the Material name.

## Find an icon and its name

- **Search online:** <https://marella.github.io/material-symbols/demo/>, the preview page of the npm package. Choose the **Outlined** style, which is the one the app uses.
- **The package:** <https://www.npmjs.com/package/@material-symbols/svg-400>, source at <https://github.com/marella/material-symbols/tree/main/svg/400>.
- **The name** is the file name without `.svg`, for example `restart_alt`. Files ending in `-fill` are the filled variants; the app does not use them.
- **What you can use now** is what the installed version contains. The online page can be newer and show icons your copy does not have yet. List the installed names that contain a word:

```bash
ls node_modules/@material-symbols/svg-400/outlined | grep -v -- -fill | grep zoom
```

## Replace an icon

1. Find a name (above).
2. Change the name of the key in `T:icons`.
3. Run `npm run build:icons`. If it reports the name as missing, add an alias in the script (the package file name may differ).
4. Run the tests below and commit `tunables.ts` and `sprite.svg` together.

## Add an icon

Do the same with a new key. For every key add `a11y.<key>` (the accessible label) and `tooltip.<key>` to **all seven** files in `src/assets/i18n/` (English text in the untranslated ones, see `docs/i18n-status.md`). Remove a key that is no longer used and rebuild: the sprite must hold exactly the icons of `T:icons`.

## Which tests cover it

| Test | Covers |
|---|---|
| `src/testing/icon-usage.spec.ts` (UIX-029) | the sprite holds exactly the names of `T:icons`; every icon the code names is a key there; only `app-icon` draws SVG; every label key has texts in all seven languages |
| `src/testing/icons.spec.ts` (UIX-010, GEN-010) | a symbol for every name; an English label and tooltip for every key |
| `e2e/icons.spec.ts` (UIX-010) | icons added after the first load are drawn at once |

Run them with `npm test -- --watch=false` and `npx playwright test e2e/icons.spec.ts`.

## Icons chosen in V2-M5

| Button | Key | Material name |
|---|---|---|
| Settings (top bar) | `settings` | `menu` (three lines) |
| Reset all settings | `resetSettings` | `restart_alt` |
