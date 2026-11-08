# iOS distribution through Firebase App Distribution (owner how-to, no Mac needed)

The `ios` workflow (`.github/workflows/ios.yml`) always builds the unsigned simulator app. It additionally builds a **signed ad hoc IPA** and uploads it to Firebase App Distribution **only when all the secrets below exist**; until then those steps are skipped and the run stays green (decisions DEC-120, DEC-121). Requirement PIP-010.

## What you need

- For the **signed** route: a paid **Apple Developer Program** membership (a free Personal Team cannot create ad hoc profiles). Ad hoc builds run only on devices whose UDID is in the provisioning profile. Without a membership see "Experiment: unsigned build" at the end.
- An iOS app in your Firebase project (same project as Android and Hosting) with the bundle ID `app.web.codexmusicae`.
- Testers' devices, registered (step 4).

## 1. Distribution certificate (done on Linux with `openssl`)

```bash
openssl genrsa -out ios-distribution.key 2048
openssl req -new -key ios-distribution.key -out ios-distribution.csr -subj "/emailAddress=<your mail>/CN=<your name>/C=DE"
```

Apple Developer portal → Certificates → **+** → *Apple Distribution* → upload the `.csr` → download `distribution.cer`. Then build the `.p12`:

```bash
openssl x509 -inform DER -in distribution.cer -out distribution.pem
openssl pkcs12 -export -inkey ios-distribution.key -in distribution.pem -out ios-distribution.p12 -legacy
```

(Choose an export password; drop `-legacy` if your `openssl` is older than 3.) Keep the `.key` and `.p12` private; never commit them.

## 2. App ID and ad hoc profile

Portal → Identifiers → **+** → App IDs → App → explicit bundle ID `app.web.codexmusicae` (no extra capabilities are needed).
Portal → Profiles → **+** → *Ad Hoc* → that App ID → the certificate from step 1 → the registered devices → download `*.mobileprovision`.

## 3. Firebase

Firebase console → Project settings → add an **iOS app** with the bundle ID; copy its app ID (`1:…:ios:…`). Use two tester groups: the owners group (variable `FIREBASE_OWNERS_TESTER_GROUPS`, receives every build from any branch) and the iOS testers group (variable `FIREBASE_IOS_TESTER_GROUPS`, receives builds of `main` only). Both are listed in `docs/milestones/V1-M00.md`.

## 4. Tester devices

A device can only install the build if its UDID is in the profile. Invite the testers in Firebase; each tester registers their device when opening the invitation, and Firebase mails you the UDIDs (also in the console under App Distribution → Testers & Groups, and via the Firebase CLI). Add them in the portal (Devices → Register Multiple Devices), edit the ad hoc profile to include them, download it again and replace the secret in step 5. Apple limits the devices per account per year.

## 5. GitHub secrets and variables

Settings → Secrets and variables → Actions (never put these into the repository):

| Name | Kind | Content |
|---|---|---|
| `IOS_CERTIFICATE_BASE64` | secret | `base64 -w0 ios-distribution.p12` |
| `IOS_CERTIFICATE_PASSWORD` | secret | the `.p12` export password |
| `IOS_PROVISIONING_PROFILE_BASE64` | secret | `base64 -w0 <profile>.mobileprovision` |
| `FIREBASE_IOS_APP_ID` | variable | the Firebase iOS app ID |
| `FIREBASE_OWNERS_TESTER_GROUPS` | variable | the owners group alias (every build) |
| `FIREBASE_IOS_TESTER_GROUPS` | variable | the iOS testers group alias (builds of `main` only) |

`FIREBASE_SERVICE_ACCOUNT_CODEX_MUSICAE` (Android and Hosting already use it) is reused. When the three Apple secrets, the service account and `FIREBASE_IOS_APP_ID` are set, the next `ios` run signs and uploads (to the owners group; also to the iOS testers group on `main`). If neither group variable gives a group for the branch, the upload is skipped. Every member of a group needs a device UDID in the profile, the owners included.

## Notes

- The profile expires after a year and the certificate after a year; renew both and update the secrets.
- The first signed run is unverified (command-line signing overrides with the Swift package project); if `xcodebuild archive` fails, the artifact `ios-build-log` has the log.
- The unsigned build costs macOS minutes at 10x on a private repository (about 200 free minutes a month); the signed archive adds a few more minutes per run. Narrow the trigger to `main` in `ios.yml` (see the comment there) to save them.

## Unsigned build without a developer account (DEC-127)

Firebase App Distribution **cannot** take an unsigned iOS build: an experiment upload was rejected with "error parsing your app's provisioning profile. Ensure you are uploading a validly signed IPA". Android works with Firebase because its installer accepts any APK; iOS installs over the air and needs a signed ad hoc IPA, so the Firebase route needs the paid membership above.

Without the signing secrets the `ios` workflow therefore builds `codexmusicae-unsigned.ipa` (Release, `iphoneos`, no signing) and keeps it as a **GitHub Actions artifact** named `codexmusicae-unsigned-ipa` (14 days). No secret or variable is needed for this.

- **Get the file:** GitHub → Actions → the `ios` run → Artifacts → `codexmusicae-unsigned-ipa` (needs read access to the repository; otherwise the owner downloads it and passes the file on). Unzip the download to get the `.ipa`.
- **Re-sign and install:** Sideloadly or AltStore on Mac or Windows, free Apple ID, iPhone or iPad connected to the computer (cable or Wi-Fi sync), Developer Mode on (iOS 16 or newer), then trust the developer profile (*Settings → General → VPN & Device Management*). The tool rewrites the bundle ID.
- **Limits:** the app stops working after 7 days (re-sign it); a free Apple ID allows 3 sideloaded apps at a time and a limited number of new app IDs per week.
- **Manual run:** a `workflow_run` workflow runs from the file on `main`; to try a branch use Actions → `ios` → Run workflow and pick the branch.
