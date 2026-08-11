# SRS RN DASH Play Feature Design

**Date:** 2026-08-05
**Status:** Approved
**Builds on:** `docs/superpowers/specs/2026-07-25-srs-rn-unified-app-design.md`, `docs/superpowers/specs/2026-07-26-srs-rn-hls-play-design.md`, `docs/superpowers/specs/2026-08-05-srs-rn-srt-design.md`

## Objective

Add MPEG-DASH playback to the SRS RN application as a fifth protocol feature alongside WHIP publishing, WHEP playback, HLS playback, and SRT playback. The work reuses the libVLC media stack introduced by the SRT feature (`react-native-vlc-media-player`) and validates that a second DASH-capable media stack can be added as a separate feature directory with no new native dependency.

DASH was first attempted with `react-native-video` 6.19.2. That path is non-viable on iOS: the iOS native tree has zero DASH/MPD handling and hands every non-`.m3u8` URL straight to `AVPlayerItem(asset:)`, and AVPlayer does not play MPEG-DASH (Apple supports HLS only). DASH works on Android only (ExoPlayer `media3-exoplayer-dash`). Because the app targets iOS primarily, this feature uses libVLC instead, whose DASH support is independent of AVPlayer.

## Project Identity and Scope

The feature is added entirely inside the existing `SRSRN/` application. There is no new application, no new native project, no new dependency, and no rename.

### Included

- A new `features/dash/` feature directory owning its URL-entry screen, player screen, validation, session hook, and types.
- A new launcher entry and two new typed navigation routes.
- A DASH player built on the already-installed `react-native-vlc-media-player` (libVLC), which handles DASH manifest parsing, segment fetch, demux, and decode natively.
- The same explicit-Start, generation-guarded, idempotent-teardown session lifecycle policy used by the WHIP, WHEP, HLS, and SRT features, adapted to libVLC's component-mounted player. As with SRT, libVLC exposes an imperative `stopPlayer()` ref method, so the DASH hook performs a **true imperative cleanup**.
- Automated tests mirroring the SRT test suite, plus launcher and URL-entry coverage.
- iOS build verification and Android structural/Gradle verification.

### Excluded

- Modifying the existing `features/whip/`, `features/whep/`, `features/hls/`, `features/srt/`, or the legacy `WHIPPublisher/` / `WHEPPlayer/` applications.
- Adding any new native dependency, pod, permission, or Gradle configuration. The DASH feature reuses the `react-native-vlc-media-player` dependency, its jest mock, its type augmentation, the `MobileVLCKit` pod, and the Android `libc++_shared.so` workaround already added by the SRT feature.
- A shared media-session abstraction across WHIP, WHEP, HLS, SRT, and DASH. The unified-app spec explicitly excludes this, and this feature must not introduce one.
- Persisting the edited DASH URL between launches (consistent with the other features).
- Allowing playback to continue in the background after navigation (consistent with the other features).
- Requiring Android emulator or physical-device runtime verification (consistent with the other features).
- Surfacing specific libVLC error text. libVLC's `onError` event carries only a `target` id and no message field, so user-visible DASH errors are a generic "Playback error". This is the same accepted limitation as SRT.

## Architecture

The feature follows the feature-based structure established by the unified application:

```text
SRSRN/
├── launcher/
│   └── features.ts            # +1 launcher entry
├── navigation/
│   ├── RootNavigator.tsx      # +2 Stack.Screen entries
│   └── types.ts               # +2 routes in RootStackParamList
├── screens/
│   └── HomeScreen.tsx         # unchanged layout
└── features/
    └── dash/                  # new feature directory
        ├── DashUrlScreen.tsx
        ├── DashPlayerScreen.tsx
        ├── useDashSession.ts
        ├── validation.ts
        └── types.ts
```

Test files follow the existing `SRSRN/__tests__/` placement: `DashUrlScreen.test.tsx`, `DashPlayerScreen.test.tsx`, and `dash-validation.test.ts`.

The feature owns its screens, validation, route-facing types, media lifecycle, and focused tests. It must be understandable and changeable without reading or modifying the WHIP, WHEP, HLS, or SRT implementations.

## Media Stack

- **`react-native-vlc-media-player`** is the media stack. It is **not** a new dependency: it was added by the SRT feature and is already in `package.json`, `node_modules`, the iOS `Podfile.lock` (`MobileVLCKit`), and the Android Gradle config (`libc++_shared.so` workaround). Its jest mock and type augmentation are already in `jest.setup.js` and `types/react-native-vlc-media-player.d.ts`. The DASH feature imports the same named `VLCPlayer` component and reuses the same `VLCPlayerInstance` ref type.
- The player is the `<VLCPlayer>` component, rendered by `DashPlayerScreen` and bound, via a ref, to the session hook. The ref exposes imperative methods including `stopPlayer()`, `seek()`, and `resume()`.
- libVLC handles the DASH manifest parse, segment fetch over HTTP, demultiplexing, and decode natively. It does not use AVPlayer, so it is not subject to AVPlayer's HLS-only limitation.
- The feature uses no `react-native-webrtc` primitives, no `getUserMedia`, no `react-native-video`. There is no peer connection, no SDP, no transceivers, and no camera or microphone access.
- **Viability:** DASH is a **core VLC demuxer** (`modules/demux/dash/` and `modules/stream_filter/dash/`), present in VLC since 2.1 and compiled into standard VLC/MobileVLCKit builds. This is the critical distinction from SRT: SRT required **libsrt**, an optional external library excluded from stable `MobileVLCKit` 3.5.1, which is why SRT playback failed. DASH has no such external dependency - the demuxer is part of VLC itself. VLC 3.x's DASH demuxer handles standard live and on-demand MPEG-DASH manifests. Compatibility with SRS's specific DASH output is the gating device check (see Verification).

## Launcher

The Home screen's two-column grid renders from `LAUNCHER_FEATURES`. A fifth entry is appended; no `HomeScreen` layout logic changes.

The new launcher entry:

```text
id:           dash
title:        DASH Play
description:  Play a DASH stream from an SRS server via VLC.
actionLabel:  Open DASH
color:        #0e7490          (teal/cyan, distinct from WHIP blue, WHEP green, HLS amber, SRT purple)
destination:  DashUrl
```

The `LauncherDestination` union gains `'DashUrl'`. The launcher configuration remains limited to presentation and routing; it defines no connection, transport, or media-session interface.

## Navigation

One typed native-stack navigator, extended with two routes:

```text
Home
├── WhipUrl  -> Publisher
├── WhepUrl  -> Player
├── HlsUrl   -> HlsPlayer
├── SrtUrl   -> SrtPlayer
└── DashUrl  -> DashPlayer
```

`RootStackParamList` gains:

- `DashUrl: undefined`
- `DashPlayer: {dashUrl: string}`

The DASH URL is passed from `DashUrlScreen` to `DashPlayerScreen` as a typed route parameter, exactly as the other features pass theirs. WHIP, WHEP, HLS, and SRT routes and defaults remain independent and unchanged.

The route is named `DashPlayer` (prefixed for clarity, matching the `SrtPlayer`/`HlsPlayer` convention). The existing player screens are not renamed.

Only one media screen can be mounted at a time. Returning from `DashPlayerScreen` unmounts it and triggers complete session teardown before the user opens another feature, consistent with the other media screens.

## DASH Playback Flow

1. From Home, the user selects DASH Play.
2. `DashUrlScreen` displays an editable field initialized with `DEFAULT_DASH_URL`.
3. The screen accepts only syntactically valid `http://` / `https://` URLs (DASH is delivered over HTTP).
4. A valid submission navigates to `DashPlayerScreen` with the URL as a typed route parameter.
5. `DashPlayerScreen` starts only when the user presses Start. Entering the screen does not create a player or begin loading.
6. Start creates a uniquely identified session attempt and renders `<VLCPlayer source={{uri: dashUrl}} autoplay paused={false}>` bound to the hook's player ref.
7. libVLC fetches the `.mpd` manifest, parses it, pulls the listed segments, and decodes them natively. `onPlaying` transitions the attempt to active; `onError` transitions it to error.
8. Stop, navigation away, unmount, retry, or startup failure marks the attempt obsolete, calls `stopPlayer()` on the ref, and unmounts the `<VLCPlayer>`.
9. After cancellation or failure, a still-mounted screen is ready for a fresh Start.
10. No session remains active after leaving `DashPlayerScreen`.

## Session Lifecycle

`useDashSession()` mirrors the structure and guarantees of `useSrtSession` (the closest analogue - same VLC media stack, same imperative `stopPlayer()` ref method, same `onPlaying`/`onError` callbacks, same `{target}`-only error payload). It is structurally identical to `useSrtSession` with only naming changes; the one behavioral difference is the URL scheme accepted upstream by `validateDashUrl`.

Each media screen owns its session state; there is no global player.

The lifecycle rules:

- Start is explicit and guarded against duplicate requests. A second concurrent session cannot be started from the same screen.
- Each accepted Start creates one uniquely identified session attempt.
- Stop, navigation away, unmount, retry, or startup failure marks the current attempt obsolete before cleanup begins.
- An obsolete attempt must not transition status, install a player, report a result to the current UI, or otherwise update screen state.
- The player's internal manifest fetch and segment pulls cannot be aborted by the application. Per the unified-app lifecycle policy, operations that cannot be aborted may settle, but their results are ignored: late `onPlaying`/`onError`/`onLoad` callbacks from an obsolete attempt are dropped by the `isCurrent(attempt)` guard rather than acted on.
- Cleanup stops and releases the attempt's player via `playerRef.current.stopPlayer()`, marks the attempt closed, and is safe to invoke more than once (idempotent, guarded by a `closed` flag). The subsequent status -> `idle` transition unmounts `<VLCPlayer>`, releasing the native player.
- Partial setup is cleaned up if any later step fails.
- A stale attempt cannot stop, replace, or otherwise interfere with a player owned by a newer attempt.
- After cancellation or failure, a still-mounted screen is ready for a fresh Start.
- No session remains active after leaving `DashPlayerScreen`.

### Attempt shape

The DASH attempt mirrors the SRT attempt (and HLS):

```text
DASH attempt: { id, closed }
```

- `id` and `closed` carry over unchanged from SRT/HLS.
- There is no `pc` (no PeerConnection), no `stream` (no `MediaStream`), and no `abort` (no application-controlled fetch). libVLC pulls the manifest and segments internally; the `closed`/`isCurrent` guard honors the non-abortable-settles-and-is-ignored rule.

The hook owns a `playerRef` (a `React.useRef` holding the `VLCPlayer` instance). `DashPlayerScreen` attaches that ref to the rendered `<VLCPlayer>` and wires the hook's `onPlaying`/`onError` callbacks, each guarded by `isCurrent(attempt)` before it mutates state. The per-attempt `onPlaying`/`onError` closures are stored in a `handlers` state variable so a stale attempt's late event short-circuits via `isCurrent(attempt)` capturing that attempt - the same ownership split SRT uses.

### Imperative cleanup

Identical to SRT: `cleanupAttempt` calls `playerRef.current?.stopPlayer()` before the status -> `idle` unmount. This is a real imperative stop, structurally close to WHEP's `pc.close()`. The `closed` flag plus `isCurrent(attempt)` guard still drops any late `onPlaying`/`onError` that arrive after cleanup begins.

## Error Handling

The feature follows the same policy as WHIP, WHEP, HLS, and SRT, without sharing implementation code:

- Invalid URLs are rejected on the URL-entry screen and do not navigate.
- Player errors (unreachable server, malformed manifest, decode failure) arrive asynchronously via `onError` and are reported only if the owning attempt is still current.
- libVLC's `onError` event payload is `{target: number}` with no message field, so the user-visible message is the generic `'Playback error'` - identical to SRT. The hook does not fabricate a more specific message. Development logs are the avenue for deeper diagnosis.
- Any resources acquired before a failure are released before retry.
- A failed start leaves the user on `DashPlayerScreen`, where they can retry or navigate back.
- Unreachable-server and player-error states must be recoverable without restarting the application.

## Native Configuration

### None new

The DASH feature adds **no** native configuration. It reuses, unchanged, everything the SRT feature installed:

- **Dependency:** `react-native-vlc-media-player` `1.0.98` is already in `package.json`.
- **iOS pod:** `MobileVLCKit` is already in `Podfile.lock` and installed.
- **Type augmentation:** `types/react-native-vlc-media-player.d.ts` already exports the named `VLCPlayer` and `VLCPlayerInstance` type.
- **jest mock:** `jest.setup.js` already mocks `react-native-vlc-media-player` with `__mockVlcInstances`, `__resetVlcMocks`, and `__fireOnPlaying`/`__fireOnError`/`__fireOnLoad`.
- **iOS permission:** `NSLocalNetworkUsageDescription` is already in `ios/SRSRN/Info.plist` (added by SRT for local-network playback; DASH defaults also target `192.168.1.100`).
- **App Transport Security:** DASH is HTTP, covered by the existing `NSAllowsLocalNetworking` configuration. No change.
- **Android Gradle:** the `libc++_shared.so` merge workaround is already in `android/app/build.gradle`. No change.
- **Android permissions:** none added (play-only, no capture).

## URL Entry and Validation

- `DEFAULT_DASH_URL = 'http://192.168.1.100:8080/live/livestream.mpd'` - the SRS DASH endpoint, matching the host (`192.168.1.100`), HTTP port (`8080`), and app/stream (`live`/`livestream`) used by the HLS default. SRS serves DASH at the same HTTP server port as HLS, with the `.mpd` extension instead of `.m3u8`. SRS requires DASH to be enabled in its config (`dash { enabled on; }`); the default URL assumes the user has done so, consistent with every other feature pointing at a server the user configures.
- `validateDashUrl` mirrors `validateHlsUrl` (not `validateSrtUrl`): trim, reject empty, parse as `URL`, require the `http:` or `https:` protocol. It does **not** enforce the `.mpd` suffix - validation stays syntactic and consistent with HLS (which does not enforce `.m3u8`). A URL without a suffix is accepted, matching HLS behavior.
- `DashUrlScreen` mirrors `HlsUrlScreen`/`SrtUrlScreen`: an editable `TextInput` seeded with `DEFAULT_DASH_URL`, inline error feedback, and navigation to `DashPlayer` with `{dashUrl: result.url}` on valid submit. Test IDs: `dash-url-input`, `dash-url-error`, `dash-url-connect`.

## Testing

### Home Screen

- The DASH card renders from `LAUNCHER_FEATURES` alongside WHIP, WHEP, HLS, and SRT.
- The DASH card navigates to `DashUrl`.
- A sixth launcher entry can still be rendered without changing Home screen layout logic (the existing extensibility test, with the synthetic extra entry using a non-colliding id; the current synthetic id `dash` must be renamed because the real `dash` entry this feature adds would collide).

### URL Entry

- Displays `DEFAULT_DASH_URL`.
- Keeps the URL editable.
- Shows feedback for invalid input.
- Does not navigate with invalid input.
- Navigates with the exact valid URL as a typed parameter.
- Does not use or overwrite the WHIP, WHEP, HLS, or SRT defaults.

### Validation

- Rejects empty input.
- Rejects non-URL input.
- Rejects non-`http(s)` schemes (e.g., `srt://`, `ftp://`).
- Accepts valid `http://` and `https://` URLs, including `DEFAULT_DASH_URL`.

### Player Screen and Session Hook

- No `<VLCPlayer>` is rendered and no session exists before Start.
- Rapid repeated Start presses create only one attempt.
- Stop and unmount during player loading leave no active session, and `stopPlayer()` is called on the ref.
- A late `onPlaying` or `onError` from an obsolete attempt does not update UI state or replace a newer attempt's state.
- Cleanup after failure, Stop, and unmount is idempotent (Stop + unmount + late events do not throw or double-clean).
- A failed start (`onError`) leaves the screen ready for a fresh Start.
- A player error produces a user-visible, recoverable message (generic "Playback error").

### App Navigation

- `DashUrl` and `DashPlayer` mount through the unified navigator.
- Home remains the initial route.

## Verification

Run all commands inside `SRSRN/`, because it is an independent application.

Required automated and build checks:

1. Run TypeScript checking.
2. Run ESLint.
3. Run Jest, including the new DASH suites.
4. Build the iOS workspace (no new pods; `pod install` should be a no-op but is run to confirm).
5. Run an Android Gradle configuration check (no new Gradle config; the existing `libc++_shared.so` workaround applies).

Required iOS functional checks (when a device and a reachable SRS DASH endpoint are available):

1. Launch into Home and confirm the DASH card is present.
2. Open DASH, retain or edit the URL, press Start, receive DASH playback, and stop cleanly.
3. Return Home mid-playback and confirm playback has ended.
4. Confirm an unreachable server, a malformed manifest, and a decode error each produce an understandable, recoverable message (generic "Playback error").

**Gating device check:** DASH is a core VLC demuxer (not an external library like libsrt), so the structural risk that sank SRT does not apply. However, VLC 3.x's DASH demuxer compatibility with SRS's specific DASH manifest output is unverified. An actual `.mpd` stream **must** be played on a device to confirm libVLC's DASH demuxer parses and plays SRS's output. If DASH playback does not work, this approach fails and the project reconsiders (a different DASH-capable player, or a different protocol). Do not claim DASH playback was verified unless a `.mpd` stream was actually observed playing.

If a physical device or reachable SRS endpoint is unavailable, complete all possible automated and native build checks and explicitly report the remaining manual steps. Do not claim endpoint-dependent behavior was verified when it was not observed.

## Acceptance Criteria

The work is complete when:

- `features/dash/` is a clean, independent feature directory with its own URL-entry screen, player screen, validation, session hook, and types.
- `features/whip/`, `features/whep/`, `features/hls/`, `features/srt/`, and the legacy `WHIPPublisher/` / `WHEPPlayer/` applications remain unchanged.
- Home renders the DASH card from launcher configuration with no change to `HomeScreen` layout logic.
- The DASH flow preserves an editable default URL, explicit Start, native playback, error handling, and teardown, structurally mirroring the SRT lifecycle, with a true imperative `stopPlayer()` cleanup.
- No new native dependency, pod, permission, or Gradle configuration was added - the feature reuses the SRT feature's VLC infrastructure.
- Stop and navigation-away teardown prevent an active DASH session from lingering.
- A second use of the libVLC media stack was added **without** introducing a shared media-session abstraction and **without** redesigning Home.
- TypeScript, lint, and Jest checks pass.
- The iOS workspace builds successfully and functional checks are completed where device and endpoint access permit.
- Android remains structurally valid and passes the selected Gradle configuration check.
- **DASH-via-VLC is verified to play an actual `.mpd` stream on a device.**
