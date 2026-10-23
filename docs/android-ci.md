# Android CI builds

The Android workflow builds a signed release APK for Firebase App Distribution and a debug APK as a separate GitHub Actions artifact. The production package ID is `app.web.codexmusicae`; the debug build uses `app.web.codexmusicae.debug` so both can be installed at once.

## Configure release signing

Create a release keystore once and keep a protected backup. Reuse the same keystore for every release so Android accepts future builds as updates to the installed app.

```sh
keytool -genkeypair -v \
  -keystore codex-musicae-release.keystore \
  -alias codex-musicae \
  -keyalg RSA -keysize 2048 -validity 10000
```

Add these repository Actions secrets under **Settings → Secrets and variables → Actions**:

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | Base64 encoding of the keystore file, with no line wrapping (for example, `base64 -w 0 codex-musicae-release.keystore` on Linux) |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | `codex-musicae`, or the alias selected when creating the keystore |
| `ANDROID_KEY_PASSWORD` | Password for the selected key |

Do not commit the keystore or put its passwords in repository files. The workflow decodes the keystore into the runner's temporary directory and verifies the resulting APK signature before publishing it.

## Versions

Push a tag in `vMAJOR.MINOR.PATCH` format, such as `v1.2.3`, to build a release with version name `1.2.3`. Other workflow runs use `0.0.0-ci.<run_number>`. The numeric Android version code is `run_number * 100 + run_attempt`, making retries newer than the previous attempt. Keep attempts below 100; the configuration script rejects values outside that range.

The workflow uploads both APKs in the `codex-musicae-android-builds` artifact. Only the signed release APK is sent to Firebase App Distribution.
