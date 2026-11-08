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

## Experiment: unsigned build without a developer account (DEC-127)

Open question: does Firebase App Distribution accept an **unsigned** device IPA, and can a tester then download it and re-sign it on their own computer (Sideloadly or AltStore with a free Apple ID; Xcode on a Mac also works)? Android works this way because its installer accepts any APK; on iOS Firebase normally installs over the air and needs a signed ad hoc IPA, so the expected result is a rejection. The `ios` workflow tries it anyway.

- **When it runs:** only when the signed route is **not** configured and the variables `FIREBASE_IOS_APP_ID` and `FIREBASE_OWNERS_TESTER_GROUPS` and the service account secret exist. It builds `codexmusicae-unsigned.ipa` (Release, `iphoneos`, no signing) and uploads it to the **owners group only**, on every branch; the release notes start with "UNSIGNED EXPERIMENT".
- **It never fails the job:** the upload step has `continue-on-error`. The run summary says whether Firebase accepted or rejected the file and shows the last lines of the CLI output.
- **Run it by hand:** GitHub → Actions → `ios` → *Run workflow*.
- **Reading the verdict:** rejected → the idea is dead, remove the three experiment steps in `ios.yml` and `check-ios-config.mjs` rules. Accepted → open the release as an owners-group tester and check whether the IPA can be downloaded (not only installed). If it can, testers follow route C in `docs/ios-unverified.md`.
- **Tester limits if it works:** the iPhone is connected to the computer while signing; a free Apple ID allows 3 sideloaded apps and the app expires after 7 days; Developer Mode must be on (iOS 16 or newer); the tool rewrites the bundle ID.
