# Rooted 0.5.0 — offline Android

The single maintained app is rooted-0.5.0.apk. Package com.tobiasfletcher.rooted, version code 7, Android 8+ (API 26), target/compile API 36. App source is app/src/main/assets/www plus the Java host. Do not regenerate it from the old website or Preview source.

## Updating safely

Export a backup from your currently installed Rooted, then install this APK over it. Do not uninstall or clear app data. It uses the same app identity and development signing certificate as the earlier regular Rooted APKs. An independently signed installation is not covered by that compatibility test.

The journal remains local. No Internet permission, sign-in, Firebase SDK, remote scripts/fonts, ads or analytics. Previously cached account journals can be reviewed under Settings → Earlier saved journals; nothing is downloaded or merged automatically. This version does not delete old remote accounts or records.

## Historical records

- New moves and stage changes are structured dated facts. Backdated changes do not override later facts.
- Automatic container-care links follow the plant's placement and stage at the care date. Correcting a move or stage updates those links. Manual links remain fixed.
- Historical slot collisions are rejected and the whole edit rolls back.
- Reservoir replacements, top-ups and explicit solution snapshots replay by occurrence date. Equal timestamps have stable ordering. Stored before/after totals are not reused as baselines, preventing double counting after date changes.
- Switching gal/L converts the form's values. Renaming or changing units alone does not create a false solution-volume snapshot.
- Unknown starting volume stays unknown until a known replacement or snapshot is recorded.
- Earlier records keep their text, photos and associations. Missing historical facts are not guessed. Use Starting placement, Edit history details and Plants included to fill gaps or confirm manual links.
- Migration preserves the earlier current plant placement, stage and solution volume as protected snapshots. After repairing incomplete history, Review current placement / Review solution history lets you explicitly choose to use the dated records instead. These confirmation steps prevent an update from silently changing your current garden.
- Original event data is retained when correcting dates/details.

## Local protection

Writes are atomic. Failed saves roll back the pending edit. Rooted retains:
- rooted-previous.json: previous valid save;
- rooted-before-import.json: copy before importing/replacing the active journal;
- rooted-before-history-v2.json: one-time unmodified journal from before the history upgrade.

The upgrade copy is saved before the first new write, not overwritten by later edits. Startup adds migration metadata only in memory and does not rewrite the original file. A damaged primary journal blocks writes and exposes recovery/import controls.

The journal limit is 40 MB serialized. Recovery copies use additional device storage. They do not protect against uninstall, clearing storage, device loss or hardware failure. Android automatic backup and device transfer remain disabled. Export backups regularly. Exported files include notes/photos and are not encrypted by Rooted; a document provider you choose may store them in the cloud under its own terms.

## Build and verification

JDK 17+, SDK 36, Gradle wrapper. Build assembleRelease/bundleRelease; assembleDebugAndroidTest builds the disposable-device instrumentation tests. Run Node tests from tests/: test.cjs, test-timeline.cjs, test-reservoir.cjs, test-offline.cjs, test-history.cjs.

The supplied APK is a non-debuggable release build signed with the existing development certificate for compatible personal updates. It is not a Play submission artifact. `app/build.gradle` signs a release build only when `ROOTED_KEYSTORE` is set in the environment. It then reads `ROOTED_STORE_PASSWORD`, `ROOTED_KEY_ALIAS`, and `ROOTED_KEY_PASSWORD`. It does not read `keystore.properties` or `local.properties`. Never commit keys or passwords. A future Play-signed installation may require an export/reinstall/import transition.

## Automatic APK builds

Every push to main runs the JavaScript regression tests, Android lint and unit tests, then builds a signed APK. Pull requests run checks without signing secrets. You can also run Build Android APK manually from the Actions tab on main.

Download rooted-apk-N from a successful run's Artifacts section, unzip it, and install the APK. Downloads are retained for 30 days. These builds use the same development certificate as the existing personal installation; they are not Play Store releases. Export a backup before updating, and install over the existing app without uninstalling. CI version codes are 100 plus the workflow run number; future local/Play releases must use a higher code than the installed version.

Signing uses four encrypted Actions secrets: `ROOTED_KEYSTORE_BASE64`, `ROOTED_STORE_PASSWORD`, `ROOTED_KEY_ALIAS`, and `ROOTED_KEY_PASSWORD`. The workflow passes the last three straight through as the `ROOTED_*` environment variables above, and it writes the decoded keystore to a temporary file named by `ROOTED_KEYSTORE`. If `ROOTED_KEYSTORE_BASE64` is empty, that step records "Signing is pending" and the workflow uploads an explicitly labeled unsigned APK. An empty signing secret does not fail the job. With signing configured, the key is decoded into temporary runner storage and removed after signing.

Pull requests never receive those secrets. On a push to main, a verified signed APK is published as a GitHub Release (`rooted.apk`) by a job whose only added permission is `contents: write`. The rest of the workflow stays read-only. Nothing is installed on a phone.

Use the same certificate that already signed an installed copy if that phone should update in place. A newly generated keystore is a different signer. Android will refuse to install it over the existing app. Compare certificates before replacing the four secrets. Publishing a Play release still requires a private upload key; Play rejects the Android debug certificate.

### Create a release keystore and set the four secrets

Do this on your own machine. Do not commit the keystore, and do not paste passwords into the repo, a pull request, or a shell history if you can avoid it. `keytool` prompts for the passwords and the certificate name.

```bash
keytool -genkeypair -v \
  -keystore rooted-release.keystore \
  -alias rooted \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

Confirm the certificate, then store the four values as repository Actions secrets. `gh secret set` prompts for the alias and the two passwords. The base64 command pipes the keystore into `gh` so the encoded file is not printed.

```bash
keytool -list -v -keystore rooted-release.keystore -alias rooted

gh secret set ROOTED_KEY_ALIAS --repo tobias-fletch/rooted
gh secret set ROOTED_STORE_PASSWORD --repo tobias-fletch/rooted
gh secret set ROOTED_KEY_PASSWORD --repo tobias-fletch/rooted
base64 -w0 rooted-release.keystore | gh secret set ROOTED_KEYSTORE_BASE64 --repo tobias-fletch/rooted
```

On macOS, `base64` has no `-w0`. Use `base64 < rooted-release.keystore | tr -d '\n' | gh secret set ROOTED_KEYSTORE_BASE64 --repo tobias-fletch/rooted`. You can also enter the same four names under Settings → Secrets and variables → Actions. `ROOTED_KEY_ALIAS` must be the alias you passed to `keytool` (`rooted` in the command above).

`keystore.properties.example` lists the local property names with blank values. Copy it to `keystore.properties` only as a private note. The Gradle build still has to receive the `ROOTED_*` environment variables.

### See whether an installed copy uses the current signing key

The GitHub Release APK is signed, and its certificate subject is the Android debug subject (`CN=Android Debug, O=Android, C=US`). That is a development certificate, not a Play upload key. Its public SHA-256 fingerprint is `18f36fe667f1f234d21e051ef633f6a9a5a6b9a3090664800935b0071eade05a` and its public SHA-1 fingerprint is `13ea9f77b3f0f5e743319437176881b0e2bfe330`.

A normal SDK debug keystore lives at `~/.android/debug.keystore` and uses alias `androiddebugkey`. Android documents `android` as both the store password and the key password for that file. That is the public debug default, not a password stored in this repo. List the certificate with `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey` and compare the SHA-256. If it matches, that file is the signer already stored for CI. Re-upload that same file. Do not run `keytool -genkeypair` if these phones must keep updating in place.

To read the certificate of an APK you still have:

```bash
apksigner verify --print-certs path/to/earlier.apk
```

`keytool -printcert -jarfile` only sees JAR (v1) signatures. These CI APKs are signed with APK Signature Scheme v2, so use `apksigner`. On a device with USB debugging:

```bash
adb shell pm path com.tobiasfletcher.rooted
adb pull THE_PATH_FROM_THE_PREVIOUS_COMMAND installed.apk
apksigner verify --print-certs installed.apk
```

The same SHA-256 means that install was signed by the key CI is already using. A different SHA-256 means a new keystore will not update that install.

## Remaining public release gates

Publisher-owned signing/Play App Signing, publisher/support details, public privacy policy, final store declarations, physical-device/accessibility/large-data testing, and Play testing/review remain. See TEST-RESULTS.txt for completed checks. Missing facts in old journals require user review; no software can reconstruct measurements or locations that were never recorded.
