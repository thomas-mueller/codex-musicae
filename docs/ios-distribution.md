# iOS distribution through Firebase App Distribution (owner how-to, no Mac needed)

The `ios` workflow (`.github/workflows/ios.yml`) always builds the unsigned simulator app. It additionally builds a **signed ad hoc IPA** and uploads it to Firebase App Distribution **only when all the secrets below exist**; until then those steps are skipped and the run stays green (decisions DEC-120, DEC-121). Requirement PIP-010.

## What you need

- A paid **Apple Developer Program** membership (a free Personal Team cannot create ad hoc profiles). Ad hoc builds run only on devices whose UDID is in the provisioning profile.
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

Firebase console → Project settings → add an **iOS app** with the bundle ID; copy its app ID (`1:…:ios:…`). Create a tester group for iOS and note its alias (variable `FIREBASE_IOS_TESTER_GROUPS`, already listed in `docs/milestones/V1-M00.md`).

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
| `FIREBASE_IOS_TESTER_GROUPS` | variable | the tester group alias |

`FIREBASE_SERVICE_ACCOUNT_CODEX_MUSICAE` (Android and Hosting already use it) is reused. When all five are set, the next `ios` run signs and uploads.

## Notes

- The profile expires after a year and the certificate after a year; renew both and update the secrets.
- The first signed run is unverified (command-line signing overrides with the Swift package project); if `xcodebuild archive` fails, the artifact `ios-build-log` has the log.
- The unsigned build costs macOS minutes at 10x on a private repository (about 200 free minutes a month); the signed archive adds a few more minutes per run. Narrow the trigger to `main` in `ios.yml` (see the comment there) to save them.
