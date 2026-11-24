# Android build and distribution (M3)

The `android` workflow (`.github/workflows/android.yml`) builds a signed release APK and delivers it to testers through Firebase App Distribution. Two apps are built (DEC-150): the paid app with the package ID `app.web.codexmusicae` and the free app with `app.web.codexmusicaefree` (no debug suffix); the workflow runs once per edition (matrix); `minSdk` is 29 (`android/variables.gradle`).

## Trigger

The workflow runs on `workflow_run` after a successful `lint-test` on any branch, like `deploy-web` (PIP-003), so every branch push produces a tester build. Tag pushes do not run `lint-test`, so a tag deploys nothing (PIP-009). The workflow can also be started manually (PIP-011); trigger table: `docs/ci.md`.

## Tester groups

The upload goes to the owners group (`FIREBASE_OWNERS_TESTER_GROUPS`) on every run, and additionally to the Android tester group (`FIREBASE_ANDROID_TESTER_GROUPS`) when the run is for `main`. The branch is `github.event.workflow_run.head_branch`. If no group applies (for example a feature branch while the owners variable is not set) the upload is skipped, not failed.

## Versions (PIP-006, PIP-019)

- `versionName` = `X.Y.Z` of the nearest tag, without the `v` and without a describe suffix (PIP-019; for example `1.5.0`). `scripts/version-info.mjs name` computes it for the workflow, the iOS marketing version uses the same value, and `scripts/check-versions.mjs` (part of `npm run lint`) fails when web, Android and iOS differ (PIP-020). The full describe string stays in the release notes.
- `versionCode` = `git rev-list --count HEAD`.
- Gradle reads them from the environment variables `APP_VERSION_NAME` and `APP_VERSION_CODE`; local builds default to `0.0.0` and `1`.
- A workflow step reads the built APK with `aapt2` and fails if package, `versionCode`, `versionName` or `minSdkVersion` differ from the expected values.

## Release signing (owner, once)

Create the keystore and keep a protected backup. The same key is required for every update install.

```sh
keytool -genkeypair -v -keystore codexmusicae.jks -keyalg RSA -keysize 2048 -validity 10000 -alias codexmusicae
base64 -w0 codexmusicae.jks > codexmusicae.jks.base64
```

`codexmusicae.jks` and `codexmusicae.jks.base64` are git-ignored. Never commit them or put passwords in repository files. Agents must not read, print or ask for secret values.

GitHub Actions configuration (names as in `docs/milestones/V1-M00.md`):

| Name | Kind | Content |
| --- | --- | --- |
| `ANDROID_KEYSTORE_BASE64` | secret | content of the base64 file |
| `ANDROID_KEYSTORE_PASSWORD` | secret | keystore password |
| `ANDROID_KEY_PASSWORD` | secret | key password |
| `ANDROID_KEY_ALIAS` | variable | key alias (`codexmusicae`) |
| `FIREBASE_ANDROID_APP_ID` | variable | Firebase Android app ID of the **paid** app (`1:…:android:…`) |
| `FIREBASE_ANDROID_APP_ID_FREE` | variable | Firebase Android app ID of the **free** app (register `app.web.codexmusicaefree` in Firebase first; without it the free leg cannot upload) |
| `FIREBASE_OWNERS_TESTER_GROUPS` | variable | owners group alias, comma separated; gets every build |
| `FIREBASE_ANDROID_TESTER_GROUPS` | variable | Android tester group alias, comma separated; gets builds of `main` only |
| `FIREBASE_SERVICE_ACCOUNT_CODEX_MUSICAE` | secret | service-account JSON |

The workflow decodes the keystore and the service account into the runner's temporary directory and deletes both at the end (also on failure). Without the signing variables Gradle produces an unsigned release build; local debug builds are unaffected.

## Local build

```sh
source ./init.sh        # selects JDK 21, finds the Android SDK, writes android/local.properties
npm run android:debug   # build web, cap sync, assembleDebug
```

See DEC-076 for why JDK 21 is required.
