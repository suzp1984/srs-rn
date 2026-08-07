# SRS RN SRT Play Feature Design

**Date:** 2026-08-05
**Status:** Approved
**Builds on:** `docs/superpowers/specs/2026-07-25-srs-rn-unified-app-design.md`, `docs/superpowers/specs/2026-07-26-srs-rn-hls-play-design.md`

## Objective

Add Secure Reliable Transport (SRT) playback to the SRS RN application as a fourth protocol feature alongside WHIP publishing, WHEP playback, and HLS playback. The work validates the unified application's extensibility promise with a **third distinct media stack**: libVLC (via `react-native-vlc-media-player`) after WebRTC (WHIP/WHEP) and AVPlayer (HLS). This is the strongest protocol-agnostic test yet - a non-WebRTC, non-AVPlayer transport added as a separate feature directory and launcher entry without redesigning Home or forcing a shared abstraction.

SRT publish (camera+microphone pushed to SRS via SRT) is out of scope: no React Native library supports it, and building a custom native libsrt capture/encode module is a separate, much larger effort. This feature is **playback only**.

## Project Identity and Scope

The feature is added entirely inside the existing `SRSRN/` application. There is no new application, no new native project, and no rename.

### Included

- A new `features/srt/` feature directory owning its URL-entry screen, player screen, validation, session hook, and types.
- A new launcher entry and two new typed navigation routes.
- An SRT player built on `react-native-vlc-media-player` (libVLC), which handles SRT transport, demux, and decode.
- The same explicit-Start, generation-guarded, idempotent-teardown session lifecycle policy used by the WHIP, WHEP, and HLS features, adapted to libVLC's component-mounted player. Because libVLC exposes an imperative `stopPlayer()` ref method, the SRT hook performs a **true imperative cleanup** - the closest WHEP mirror of the four features.
- Automated tests mirroring the HLS test suite, plus launcher and URL-entry coverage.
- iOS build verification and Android structural/Gradle verification.

### Excluded

- Modifying the existing `features/whip/`, `features/whep/`, `features/hls/`, or the legacy `WHIPPublisher/` / `WHEPPlayer/` applications.
- SRT publishing (no React Native library supports it; a custom native libsrt capture module is a separate project).
- A shared media-session abstraction across WHIP, WHEP, HLS, and SRT. The unified-app spec explicitly excludes this, and this feature must not introduce one.
- Persisting the edited SRT URL between launches (consistent with the other features).
- Allowing playback to continue in the background after navigation (consistent with the other features).
- Requiring Android emulator or physical-device runtime verification (consistent with the other features).
- Surfacing specific libVLC error text. libVLC's `onError` event carries only a `target` id and no message field, so user-visible SRT errors are a generic "Playback error". This is an accepted limitation of the chosen library, not a spec gap.

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
    └── srt/                   # new feature directory
        ├── SrtUrlScreen.tsx
        ├── SrtPlayerScreen.tsx
        ├── useSrtSession.ts
        ├── validation.ts
        └── types.ts
```

Test files follow the existing `SRSRN/__tests__/` placement: `SrtUrlScreen.test.tsx`, `SrtPlayerScreen.test.tsx`, and `srt-validation.test.ts`.

The feature owns its screens, validation, route-facing types, media lifecycle, and focused tests. It must be understandable and changeable without reading or modifying the WHIP, WHEP, or HLS implementations.

## Media Stack

- **`react-native-vlc-media-player`** is the one new native dependency. Its default export `VLCPlayer` is a class component backed by libVLC (`MobileVLCKit` on iOS, `libvlc-all` on Android). libVLC handles the SRT transport, demultiplexing, and decode natively.
- The player is the `<VLCPlayer>` component, rendered by `SrtPlayerScreen` and bound, via a ref, to the session hook (see Session Lifecycle). The ref exposes imperative methods including `stopPlayer()`, `seek()`, and `resume()`.
- The feature uses no `react-native-webrtc` primitives and no `getUserMedia`. There is no peer connection, no SDP, no transceivers, and no camera or microphone access.
- Dependency version compatibility with React Native 0.86, the already-installed `react-native-webrtc` 124.0.7, and `react-native-video` 6.19.2 must be verified during implementation rather than assumed. The package ships an `index.d.ts` type declaration.
- **Critical viability risk:** the package README lists supported formats as RTSP, RTP, RTMP, HLS, and MMS, and does **not** name SRT. libVLC supports SRT, but whether the prebuilt `MobileVLCKit` / `libvlc-all` artifacts bundle the SRT access module (libsrt) is unverified. Playing an actual `srt://` stream on a device is the gating verification check for this feature (see Verification).

## Launcher

The Home screen's two-column grid renders from `LAUNCHER_FEATURES`. A fourth entry is appended; no `HomeScreen` layout logic changes.

The new launcher entry:

```text
id:           srt
title:        SRT Play
description:  Play an SRT stream from an SRS server via VLC.
actionLabel:  Open SRT
color:        #7a4fbf          (purple, distinct from WHIP blue, WHEP green, HLS amber)
destination:  SrtUrl
```

The `LauncherDestination` union gains `'SrtUrl'`. The launcher configuration remains limited to presentation and routing; it defines no connection, transport, or media-session interface.

## Navigation

One typed native-stack navigator, extended with two routes:

```text
Home
├── WhipUrl  -> Publisher
├── WhepUrl  -> Player
├── HlsUrl   -> HlsPlayer
└── SrtUrl   -> SrtPlayer
```

`RootStackParamList` gains:

- `SrtUrl: undefined`
- `SrtPlayer: {srtUrl: string}`

The SRT URL is passed from `SrtUrlScreen` to `SrtPlayerScreen` as a typed route parameter, exactly as the other features pass theirs. WHIP, WHEP, and HLS routes and defaults remain independent and unchanged.

The route is named `SrtPlayer` rather than `Player` because WHEP already owns `Player`. The component is `SrtPlayerScreen` (prefixed for clarity now that three player screens exist). The existing player screens are not renamed.

Only one media screen can be mounted at a time. Returning from `SrtPlayerScreen` unmounts it and triggers complete session teardown before the user opens another feature, consistent with the other media screens.

## SRT Playback Flow

1. From Home, the user selects SRT Play.
2. `SrtUrlScreen` displays an editable field initialized with `DEFAULT_SRT_URL`.
3. The screen accepts only syntactically valid `srt://` URLs.
4. A valid submission navigates to `SrtPlayerScreen` with the URL as a typed route parameter.
5. `SrtPlayerScreen` starts only when the user presses Start. Entering the screen does not create a player or begin loading.
6. Start creates a uniquely identified session attempt and renders `<VLCPlayer source={{uri: srtUrl}} autoplay paused={false}>` bound to the hook's player ref.
7. libVLC connects to the SRT endpoint, pulls the stream, and decodes it natively. `onPlaying` transitions the attempt to active; `onError` transitions it to error.
8. Stop, navigation away, unmount, retry, or startup failure marks the attempt obsolete, calls `stopPlayer()` on the ref, and unmounts the `<VLCPlayer>`.
9. After cancellation or failure, a still-mounted screen is ready for a fresh Start.
10. No session remains active after leaving `SrtPlayerScreen`.

## Session Lifecycle

`useSrtSession()` mirrors the structure and guarantees of `useWhepSession` and `useHlsSession`. Because `react-native-vlc-media-player` exposes an imperative `stopPlayer()` ref method - which `react-native-video` v6 does not - the SRT hook performs the **closest imperative mirror** of WHEP of the four features.

Each media screen owns its session state; there is no global player.

The lifecycle rules:

- Start is explicit and guarded against duplicate requests. A second concurrent session cannot be started from the same screen.
- Each accepted Start creates one uniquely identified session attempt.
- Stop, navigation away, unmount, retry, or startup failure marks the current attempt obsolete before cleanup begins.
- An obsolete attempt must not transition status, install a player, report a result to the current UI, or otherwise update screen state.
- The player's internal SRT connection and segment fetches cannot be aborted by the application. Per the unified-app lifecycle policy, operations that cannot be aborted may settle, but their results are ignored: late `onPlaying`/`onError`/`onLoad` callbacks from an obsolete attempt are dropped by the `isCurrent(attempt)` guard rather than acted on.
- Cleanup stops and releases the attempt's player via `playerRef.current.stopPlayer()`, marks the attempt closed, and is safe to invoke more than once (idempotent, guarded by a `closed` flag). The subsequent status -> `idle` transition unmounts `<VLCPlayer>`, releasing the native player.
- Partial setup is cleaned up if any later step fails.
- A stale attempt cannot stop, replace, or otherwise interfere with a player owned by a newer attempt.
- After cancellation or failure, a still-mounted screen is ready for a fresh Start.
- No session remains active after leaving `SrtPlayerScreen`.

### Attempt shape

The WHEP attempt is `{id, pc, stream, abort, closed}`. The HLS attempt is `{id, closed}`. The SRT attempt mirrors them and, like HLS, adapts the resource fields to a component-mounted player:

```text
SRT attempt: { id, closed }
```

- `id` and `closed` carry over unchanged.
- There is no `pc` (no PeerConnection) and no `stream` (no `MediaStream`).
- There is no `abort` (no application-controlled fetch). The unified-app spec's rule that non-abortable operations may settle and be ignored is honored by the `closed`/`isCurrent` guard instead of an `AbortController`.

The hook owns a `playerRef` (a `React.useRef` holding the `VLCPlayer` instance). `SrtPlayerScreen` attaches that ref to the rendered `<VLCPlayer>` and wires the hook's `onPlaying`/`onError` callbacks, each guarded by `isCurrent(attempt)` before it mutates state. The per-attempt `onPlaying`/`onError` closures are stored in a `handlers` state variable so a stale attempt's late event short-circuits via `isCurrent(attempt)` capturing that attempt - the same ownership split WHEP and HLS use, adapted from a `MediaStream` bound to `RTCView` (WHEP) and a player ref bound to `<Video>` (HLS) to a player ref bound to `<VLCPlayer>`.

### Imperative cleanup

Unlike the HLS hook - which could not call an imperative stop and relied on unmount alone - the SRT hook calls `playerRef.current?.stopPlayer()` inside `cleanupAttempt` before the status -> `idle` unmount. This is a real imperative stop, structurally closer to WHEP's `pc.close()`. The `closed` flag plus `isCurrent(attempt)` guard still drops any late `onPlaying`/`onError` that arrive after cleanup begins.

## Error Handling

The feature follows the same policy as WHIP, WHEP, and HLS, without sharing implementation code:

- Invalid URLs are rejected on the URL-entry screen and do not navigate.
- Player errors (unreachable server, SRT handshake failure, decode failure) arrive asynchronously via `onError` and are reported only if the owning attempt is still current.
- libVLC's `onError` event payload is `{target: number}` with no message field, so the user-visible message is the generic `'Playback error'`. The hook does not fabricate a more specific message. Development logs are the avenue for deeper diagnosis.
- Any resources acquired before a failure are released before retry.
- A failed start leaves the user on `SrtPlayerScreen`, where they can retry or navigate back.
- Unreachable-server and player-error states must be recoverable without restarting the application.

## Native Configuration

### Dependencies

Add `react-native-vlc-media-player` to `SRSRN/package.json` dependencies (latest stable, pinned). Verify compatibility with React Native 0.86, `react-native-webrtc` 124.0.7, and `react-native-video` 6.19.2 before committing the version.

### iOS

- Run `pod install --project-directory=ios` to install the `MobileVLCKit` pod (pulled by the package's podspec).
- **Permissions: none for capture.** SRT playback is network receive + render. It uses neither camera nor microphone. The existing `NSCameraUsageDescription` and `NSMicrophoneUsageDescription` entries (present for WHIP/WHEP) remain and are harmless for SRT.
- **Local network usage description:** add `NSLocalNetworkUsageDescription` to `ios/SRSRN/Info.plist`. `MobileVLCKit` uses the local network when playing from local-network sources such as `srt://192.168.1.100:10080`; iOS 14+ requires this key, and App Store submission is rejected without it. The value should be a concise user-facing message.
- **App Transport Security:** SRT is UDP, not HTTP, so ATS does not apply to SRT URLs. The existing `NSAllowsLocalNetworking` configuration covers the HTTP-based WHIP/WHEP/HLS defaults and is unchanged.
- Build the generated workspace.

### Android

- `react-native-vlc-media-player`'s Gradle configuration is applied by its plugin; the `libvlc-all` dependency is pulled transitively.
- **`libc++_shared.so` conflict:** `react-native` and `LibVLC` both ship `libc++_shared.so`, and `libvlc-all` crashes when using the react-native copy. Add the merge-task workaround documented in the package README to `android/app/build.gradle` so the LibVLC copy is used. This is a known, documented requirement of the library on Android.
- **Permissions: none added.** No camera, microphone, or new network permission.
- `usesCleartextTraffic` for debug builds is already auto-wired by the React Native Gradle plugin and is irrelevant to SRT (UDP, not HTTP).
- Validate the Gradle project configuration without claiming emulator or physical-device runtime verification.

## URL Entry and Validation

- `DEFAULT_SRT_URL = 'srt://192.168.1.100:10080?streamid=#!::r=live/livestream,m=request'` - the standard SRS SRT play URL, matching the host (`192.168.1.100`) and app/stream (`live`/`livestream`) used by the other defaults. SRT's default port is 10080; `m=request` selects play mode.
- `validateSrtUrl` mirrors `validateHlsUrl`/`validateWhepUrl` in shape: trim, reject empty, parse as `URL`, require the `srt:` protocol (not `http:`/`https:`). It does **not** enforce the `streamid` shape or the `m=request` mode - validation stays syntactic, consistent with the other features. The `#` inside the streamid is parsed as a URL fragment by `new URL`; this does not affect scheme validation.
- `SrtUrlScreen` mirrors `HlsUrlScreen`/`WhepUrlScreen`: an editable `TextInput` seeded with `DEFAULT_SRT_URL`, inline error feedback, and navigation to `SrtPlayer` with `{srtUrl: result.url}` on valid submit. Test IDs: `srt-url-input`, `srt-url-error`, `srt-url-connect`.

## Testing

### Home Screen

- The SRT card renders from `LAUNCHER_FEATURES` alongside WHIP, WHEP, and HLS.
- The SRT card navigates to `SrtUrl`.
- A fifth launcher entry can still be rendered without changing Home screen layout logic (the existing extensibility test, with the synthetic extra entry using a non-colliding id).

### URL Entry

- Displays `DEFAULT_SRT_URL`.
- Keeps the URL editable.
- Shows feedback for invalid input.
- Does not navigate with invalid input.
- Navigates with the exact valid URL as a typed parameter.
- Does not use or overwrite the WHIP, WHEP, or HLS defaults.

### Validation

- Rejects empty input.
- Rejects non-URL input.
- Rejects non-`srt` schemes (e.g., `http://`, `ftp://`).
- Accepts valid `srt://` URLs, including `DEFAULT_SRT_URL`.

### Player Screen and Session Hook

- No `<VLCPlayer>` is rendered and no session exists before Start.
- Rapid repeated Start presses create only one attempt.
- Stop and unmount during player loading leave no active session, and `stopPlayer()` is called on the ref.
- A late `onPlaying` or `onError` from an obsolete attempt does not update UI state or replace a newer attempt's state.
- Cleanup after failure, Stop, and unmount is idempotent (Stop + unmount + late events do not throw or double-clean).
- A failed start (`onError`) leaves the screen ready for a fresh Start.
- A player error produces a user-visible, recoverable message (generic "Playback error").

### App Navigation

- `SrtUrl` and `SrtPlayer` mount through the unified navigator.
- Home remains the initial route.

## Verification

Run all commands inside `SRSRN/`, because it is an independent application.

Required automated and build checks:

1. Install JavaScript dependencies (adds `react-native-vlc-media-player`).
2. Run TypeScript checking.
3. Run ESLint.
4. Run Jest, including the new SRT suites.
5. Install CocoaPods dependencies (adds `MobileVLCKit`).
6. Build the iOS workspace.
7. Launch on the available physical iOS device when the environment permits.
8. Run an Android Gradle configuration check.

Required iOS functional checks (when a device and a reachable SRS SRT endpoint are available):

1. Launch into Home and confirm the SRT card is present.
2. Open SRT, retain or edit the URL, press Start, receive SRT playback, and stop cleanly.
3. Return Home mid-playback and confirm playback has ended.
4. Confirm an unreachable server, a rejected SRT handshake, and a decode error each produce an understandable, recoverable message.

**Gating device check:** because the package README does not list SRT among its supported formats, an actual `srt://` stream **must** be played on a device to confirm libVLC's SRT access module is present in the prebuilt `MobileVLCKit`/`libvlc-all` artifacts. If SRT playback does not work, this approach fails and the project reconsiders (a custom native libsrt module, or a different protocol). Do not claim SRT playback was verified unless an `srt://` stream was actually observed playing.

If a physical device or reachable SRS endpoint is unavailable, complete all possible automated and native build checks and explicitly report the remaining manual steps. Do not claim endpoint-dependent behavior was verified when it was not observed.

## Acceptance Criteria

The work is complete when:

- `features/srt/` is a clean, independent feature directory with its own URL-entry screen, player screen, validation, session hook, and types.
- `features/whip/`, `features/whep/`, `features/hls/`, and the legacy `WHIPPublisher/` / `WHEPPlayer/` applications remain unchanged.
- Home renders the SRT card from launcher configuration with no change to `HomeScreen` layout logic.
- The SRT flow preserves an editable default URL, explicit Start, native playback, error handling, and teardown, structurally mirroring the WHEP and HLS lifecycles, with a true imperative `stopPlayer()` cleanup.
- Stop and navigation-away teardown prevent an active SRT session from lingering.
- A third non-WebRTC media stack (libVLC) was added **without** introducing a shared media-session abstraction and **without** redesigning Home.
- TypeScript, lint, and Jest checks pass.
- The iOS workspace builds successfully (with `NSLocalNetworkUsageDescription` added) and functional checks are completed where device and endpoint access permit.
- Android remains structurally valid, includes the `libc++_shared.so` Gradle workaround, and passes the selected Gradle configuration check.
- **SRT-via-VLC is verified to play an actual `srt://` stream on a device.**
