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

The supplied APK is a non-debuggable release build signed with the existing DEVELOPMENT certificate for compatible personal updates. It is not a Play submission artifact. The AAB is unsigned until publisher-controlled signing is configured using ROOTED_KEYSTORE, ROOTED_STORE_PASSWORD, ROOTED_KEY_ALIAS and ROOTED_KEY_PASSWORD. Never commit keys or passwords. A future Play-signed installation may require an export/reinstall/import transition.

## Automatic APK builds

Every push to main runs the JavaScript regression tests, Android lint and unit tests, then builds a signed APK. Pull requests run checks without signing secrets. You can also run Build Android APK manually from the Actions tab on main.

Download rooted-apk-N from a successful run's Artifacts section, unzip it, and install the APK. Downloads are retained for 30 days. These builds use the same development certificate as the existing personal installation; they are not Play Store releases. Export a backup before updating, and install over the existing app without uninstalling. CI version codes are 100 plus the workflow run number; future local/Play releases must use a higher code than the installed version.

Signing requires encrypted Actions secrets: ROOTED_KEYSTORE_BASE64, ROOTED_STORE_PASSWORD, ROOTED_KEY_ALIAS and ROOTED_KEY_PASSWORD. Until those are configured, the workflow uploads an explicitly labeled unsigned build that cannot be installed. With signing configured, the key is decoded into temporary runner storage and removed after signing. Use the existing certificate for compatible personal updates. Publishing a Play release still requires production signing. Workflows have read-only repository permissions and do not automatically publish releases or install anything on a phone.

## Remaining public release gates

Publisher-owned signing/Play App Signing, publisher/support details, public privacy policy, final store declarations, physical-device/accessibility/large-data testing, and Play testing/review remain. See TEST-RESULTS.txt for completed checks. Missing facts in old journals require user review; no software can reconstruct measurements or locations that were never recorded.
