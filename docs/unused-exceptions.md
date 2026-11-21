# Unused-code and unused-dependency exceptions

Findings of `scripts/check-unused-code.mjs` (PIP-013) and `scripts/check-unused-dependencies.mjs` (PIP-014, V2-M1 S2) that are intentional. One line per key: `- **key** reason`; the key is a file path, `path#exportName`, or a package name. Both scripts run in `npm run lint`; they fail on a finding without an entry and on an entry that no longer matches a finding (remove it then). Specs and `src/testing/` count as users of an export; only unused exports of application code are findings.

## Files

- **src/app/ports/index.ts** Barrel of the port interfaces that `docs/architecture.md` names as the one place to list every port; nothing imports it because each file imports the port it needs.

## Dependencies used implicitly (no import in the repository)

- **@angular/compiler** Loaded by the Angular tooling and the JIT test runner, never imported by name.
- **@angular/compiler-cli** The AOT compiler used by `ng build` and `ng test`.
- **@angular/forms** Declared in V1 and not imported anywhere (no form or `ngModel` in the code). Left in place because removing it changes `package-lock.json` and `THIRD_PARTY_NOTICES.txt`; the owner decides whether to drop it (not a behavior change).
- **@capacitor/android** The native Android project (`android/`) is built from it by `cap sync`; no import.
- **@capacitor/ios** Same for the iOS project (`ios/`, `npx cap sync ios` in `ios.yml`).
- **jsdom** The DOM environment of the Vitest runner behind `ng test`.
- **prettier** Formatter run by editors and the owner with `.prettierrc`; no script calls it.
- **tslib** `importHelpers: true` in `tsconfig.json` makes the compiler emit imports of it.
- **@vitest/coverage-v8** Coverage provider of Vitest, loaded by `ng test --coverage` (DEC-140); no import.
