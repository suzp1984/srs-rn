# SRS RN HLS Play Feature Design

**Date:** 2026-07-26
**Status:** Approved
**Builds on:** `docs/superpowers/specs/2026-07-25-srs-rn-unified-app-design.md`

## Objective

Add HTTP Live Streaming (HLS) playback to the SRS RN application as a third protocol feature alongside the existing WHIP publishing and WHEP playback flows. The work exists primarily to validate the unified application's central extensibility promise: a non-WebRTC protocol can be added as a separate feature directory and launcher entry without redesigning `Home` and without forcing the new protocol into a WebRTC-specific abstraction.

HLS is a distribution format. SRS produces HLS from an existing ingest (WHIP, RTMP, or SRT), so this feature is **playback only**; there is no HLS publish flow.

## Project Identity and Scope

The feature is added entirely inside the existing `SRSRN/` application. There is no new application, no new native project, and no rename.

### Included

- A new `features/hls/` feature directory owning its URL-entry screen, player screen, validation, session hook, and types.
- A new launcher entry and two new typed navigation routes.
- An HLS player built on `react-native-video` (native `AVPlayer` on iOS, `ExoPlayer` on Android).
- The same explicit-Start, generation-guarded, idempotent-teardown session lifecycle policy used by the WHIP and WHEP features, adapted to a component-mounted player.
- Automated tests mirroring the WHEP test suite, plus launcher and URL-entry coverage.
- iOS build verification and Android structural/Gradle verification.

### Excluded

- Modifying the existing `features/whip/`, `features/whep/`, or the legacy `WHIPPublisher/` / `WHEPPlayer/` applications.
- HLS publishing (SRS does not define one).
- A shared media-session abstraction across WHIP, WHEP, and HLS. The approved unified-app spec explicitly excludes "Building a generic media-session abstraction across unrelated protocols," and this feature must not introduce one.
- Low-Latency HLS configuration or tuning beyond what `AVPlayer`/`ExoPlayer` apply automatically. The player handles LL-HLS transparently when the server provides it; no special-casing is added.
- Persisting the edited HLS URL between launches (consistent with WHIP/WHEP).
- Allowing playback to continue in the background after navigation (consistent with WHIP/WHEP).
- Requiring Android emulator or physical-device runtime verification (consistent with WHIP/WHEP).

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
    └── hls/                   # new feature directory
        ├── HlsUrlScreen.tsx
        ├── HlsPlayerScreen.tsx
        ├── useHlsSession.ts
        ├── validation.ts
        └── types.ts
```

Test files follow the existing `SRSRN/__tests__/` placement: `HlsUrlScreen.test.tsx`, `HlsPlayerScreen.test.tsx`, and `hls-validation.test.ts`.

The feature owns its screens, validation, route-facing types, media lifecycle, and focused tests. It must be understandable and changeable without reading or modifying the WHIP or WHEP implementations.

## Media Stack

- **`react-native-video` v6** is the one new native dependency. It renders HLS natively: `AVPlayer` on iOS (native `.m3u8` parsing, including LL-HLS when the server provides it) and `ExoPlayer` on Android.
- The player is the `<Video>` component. It is rendered by `HlsPlayerScreen` and bound, via a ref, to the session hook (see Session Lifecycle).
- The feature uses no `react-native-webrtc` primitives. There is no `RTCPeerConnection`, no SDP offer/answer, no transceivers, and no `getUserMedia`. This is the point of the exercise: HLS does not share WebRTC's transport or negotiation model, and the design must not pretend it does.
- Dependency version compatibility with React Native 0.86 and the already-installed `react-native-webrtc` 124.0.7 must be verified during implementation rather than assumed.

## Launcher

The Home screen's two-column grid already renders from `LAUNCHER_FEATURES`. A third entry is appended; no `HomeScreen` layout logic changes.

The new launcher entry:

```text
id:           hls
title:        HLS Play
description:  Play an HLS stream from an SRS server.
actionLabel:  Open HLS
color:        #b26a00          (amber, distinct from WHIP blue and WHEP green)
destination:  HlsUrl
```

The `LauncherDestination` union gains `'HlsUrl'`. The launcher configuration remains limited to presentation and routing; it defines no connection, transport, or media-session interface.

## Navigation

One typed native-stack navigator, extended with two routes:

```text
Home
├── WhipUrl  -> Publisher
├── WhepUrl  -> Player
└── HlsUrl   -> HlsPlayer
```

`RootStackParamList` gains:

- `HlsUrl: undefined`
- `HlsPlayer: {hlsUrl: string}`

The HLS URL is passed from `HlsUrlScreen` to `HlsPlayerScreen` as a typed route parameter, exactly as WHIP and WHEP pass theirs. WHIP and WHEP routes and defaults remain independent and unchanged.

The route is named `HlsPlayer` rather than `Player` because WHEP already owns `Player`. The component is `HlsPlayerScreen` (prefixed for clarity now that two player screens exist). The existing WHEP `PlayerScreen` is not renamed.

Only one media screen can be mounted at a time. Returning from `HlsPlayerScreen` unmounts it and triggers complete session teardown before the user opens another feature, consistent with the WHIP and WHEP screens.

## HLS Playback Flow

1. From Home, the user selects HLS Play.
2. `HlsUrlScreen` displays an editable field initialized with `DEFAULT_HLS_URL`.
3. The screen accepts only syntactically valid HTTP or HTTPS URLs.
4. A valid submission navigates to `HlsPlayerScreen` with the URL as a typed route parameter.
5. `HlsPlayerScreen` starts only when the user presses Start. Entering the screen does not create a player or begin loading.
6. Start creates a uniquely identified session attempt; `HlsPlayerScreen` then renders `<Video source={{uri: hlsUrl}} paused={false}>` bound to the hook's player ref.
7. The player loads the manifest and segments natively. `onLoad` transitions the attempt to active; `onError` transitions it to error.
8. Stop, navigation away, unmount, retry, or startup failure marks the attempt obsolete, stops and releases the player, and unmounts the `<Video>`.
9. After cancellation or failure, a still-mounted screen is ready for a fresh Start.
10. No session remains active after leaving `HlsPlayerScreen`.

## Session Lifecycle

`useHlsSession(hlsUrl)` mirrors the structure and guarantees of `useWhepSession(whepUrl)`. Each media screen owns its session state; there is no global player.

The lifecycle rules:

- Start is explicit and guarded against duplicate requests. A second concurrent session cannot be started from the same screen.
- Each accepted Start creates one uniquely identified session attempt.
- Stop, navigation away, unmount, retry, or startup failure marks the current attempt obsolete before cleanup begins.
- An obsolete attempt must not transition status, install a player, report a result to the current UI, or otherwise update screen state.
- The player's internal manifest/segment fetches cannot be aborted by the application. Per the unified-app lifecycle policy, operations that cannot be aborted may settle, but their results are ignored: late `onLoad`/`onError` callbacks from an obsolete attempt are dropped by the `isCurrent(attempt)` guard rather than acted on.
- Cleanup stops and releases the attempt's player, clears its resource references, and is safe to invoke more than once (idempotent, guarded by a `closed` flag).
- Partial setup is cleaned up if any later step fails.
- A stale attempt cannot stop, replace, or otherwise interfere with a player owned by a newer attempt.
- After cancellation or failure, a still-mounted screen is ready for a fresh Start.
- No session remains active after leaving `HlsPlayerScreen`.

### Attempt shape and the honest mirror

The WHEP attempt is `{id, pc, stream, abort, closed}`. The HLS attempt mirrors this structure but adapts the resource fields to a component-mounted player:

```text
HLS attempt: { id, closed }
```

- `id` and `closed` carry over unchanged.
- There is no `pc` (no PeerConnection) and no `stream` (no `MediaStream`).
- There is no `abort` (no application-controlled fetch). The unified-app spec's rule that non-abortable operations may settle and be ignored is honored by the `closed`/`isCurrent` guard instead of an `AbortController`.

The hook owns a `playerRef` (a `React.useRef` holding the `<Video>` instance). `HlsPlayerScreen` attaches that ref to the rendered `<Video>` and wires the hook's `onLoad`/`onError` callbacks, each guarded by `isCurrent(attempt)` before it mutates state. This is the same ownership split WHEP uses - the hook owns the session resource, the screen binds it to a render surface - adapted from a `MediaStream` bound to `RTCView` to a player ref bound to `<Video>`.

### Honest constraint

`react-native-video` creates its player by mounting the `<Video>` component; the application cannot call `new Video()` to obtain a standalone player object detached from a component, as WHEP does with `new RTCPeerConnection()`. The mirror therefore preserves the *structure* (attempt object, generation guard, idempotent cleanup, unmount teardown) and the *guarantees* (single concurrent attempt, stale-attempt isolation, no active session after leave), while the resource is the mounted component and its ref rather than a standalone object. Forcing a standalone-player shape would fight `react-native-video`'s component model and is explicitly not done.

## Error Handling

The feature follows the same policy as WHIP and WHEP, without sharing implementation code:

- Invalid URLs are rejected on the URL-entry screen and do not navigate.
- Player errors (unreachable server, HTTP failure on the manifest, decode failure) arrive asynchronously via `onError` and are reported only if the owning attempt is still current.
- Network and player failures produce concise user-visible messages; development logs retain enough technical detail to diagnose the underlying error.
- Any resources acquired before a failure are released before retry.
- A failed start leaves the user on `HlsPlayerScreen`, where they can retry or navigate back.
- Unreachable-server and player-error states must be recoverable without restarting the application.

## Native Configuration

### Dependencies

Add `react-native-video` (v6) to `SRSRN/package.json` dependencies. Verify compatibility with React Native 0.86 and the existing native modules before committing the version.

### iOS

- Run `pod install --project-directory=ios` to install the `react-native-video` pod.
- **Permissions: none added.** HLS playback is HTTP fetch + render. It uses neither camera nor microphone. This is the first SRS RN feature that requires no device permissions. The existing `NSCameraUsageDescription` and `NSMicrophoneUsageDescription` entries (present for WHIP/WHEP) remain and are harmless for HLS.
- **App Transport Security:** the default HLS URL is cleartext HTTP to `192.168.1.100:8080`. The existing `NSAppTransportSecurity` configuration with `NSAllowsLocalNetworking` (already present for the WHIP/WHEP HTTP defaults) covers this. No new ATS entry is added.
- Build the generated workspace.

### Android

- `react-native-video`'s Gradle configuration is applied by its plugin; no manual Gradle edits beyond what its installation requires.
- **Permissions: none added.** No camera, microphone, or new network permission.
- `usesCleartextTraffic` for debug builds is already auto-wired by the React Native Gradle plugin (true in debug, false in release) and covers the cleartext HTTP default.
- Validate the Gradle project configuration without claiming emulator or physical-device runtime verification.

## URL Entry and Validation

- `DEFAULT_HLS_URL = 'http://192.168.1.100:8080/live/livestream.m3u8'` - the standard SRS HLS endpoint, matching the host (`192.168.1.100`), app (`live`), and stream name (`livestream`) already used by the WHEP default so a single SRS ingest can be consumed by both WHEP and HLS.
- `validateHlsUrl` mirrors `validateWhepUrl`: trim, reject empty, parse as `URL`, require `http:` or `https:` protocol. It does **not** enforce a `.m3u8` suffix; WHEP does not enforce path semantics either, and the validation contract stays syntactic.
- `HlsUrlScreen` mirrors `WhepUrlScreen`: an editable `TextInput` seeded with `DEFAULT_HLS_URL`, inline error feedback, and navigation to `HlsPlayer` with `{hlsUrl: result.url}` on valid submit. Test IDs: `hls-url-input`, `hls-url-error`, `hls-url-connect`.

## Testing

### Home Screen

- The HLS card renders from `LAUNCHER_FEATURES` alongside WHIP and WHEP.
- The HLS card navigates to `HlsUrl`.
- A fourth launcher entry can still be rendered without changing Home screen layout logic (the existing extensibility test).

### URL Entry

- Displays `DEFAULT_HLS_URL`.
- Keeps the URL editable.
- Shows feedback for invalid input.
- Does not navigate with invalid input.
- Navigates with the exact valid URL as a typed parameter.
- Does not use or overwrite the WHIP or WHEP defaults.

### Validation

- Rejects empty input.
- Rejects non-URL input.
- Rejects non-`http`/`https` schemes.
- Accepts valid HTTP and HTTPS HLS URLs, including URLs without a `.m3u8` suffix.

### Player Screen and Session Hook

- No `<Video>` is rendered and no session exists before Start.
- Rapid repeated Start presses create only one attempt.
- Stop and unmount during player loading leave no active session.
- A late `onLoad` or `onError` from an obsolete attempt does not update UI state or replace a newer attempt's state.
- Cleanup after failure, Stop, and unmount is idempotent.
- Visible HTTP, network, and player errors produce user-visible, recoverable messages.
- A failed start leaves the screen ready for a fresh Start.

### App Navigation

- `HlsUrl` and `HlsPlayer` mount through the unified navigator.
- Home remains the initial route.

## Verification

Run all commands inside `SRSRN/`, because it is an independent application.

Required automated and build checks:

1. Install JavaScript dependencies (adds `react-native-video`).
2. Run TypeScript checking.
3. Run ESLint.
4. Run Jest, including the new HLS suites.
5. Install CocoaPods dependencies (adds the `react-native-video` pod).
6. Build the iOS workspace.
7. Launch on the available physical iOS device when the environment permits.
8. Run an Android Gradle configuration check.

Required iOS functional checks (when a device and a reachable SRS HLS endpoint are available):

1. Launch into Home and confirm the HLS card is present.
2. Open HLS, retain or edit the URL, press Start, receive HLS playback, and stop cleanly.
3. Return Home mid-playback and confirm playback has ended.
4. Confirm an unreachable server, a missing manifest (404), and a player decode error each produce an understandable, recoverable message.

If a physical device or reachable SRS endpoint is unavailable, complete all possible automated and native build checks and explicitly report the remaining manual steps. Do not claim endpoint-dependent behavior was verified when it was not observed.

## Acceptance Criteria

The work is complete when:

- `features/hls/` is a clean, independent feature directory with its own URL-entry screen, player screen, validation, session hook, and types.
- `features/whip/`, `features/whep/`, and the legacy `WHIPPublisher/` / `WHEPPlayer/` applications remain unchanged.
- Home renders the HLS card from launcher configuration with no change to `HomeScreen` layout logic.
- The HLS flow preserves an editable default URL, explicit Start, native playback, error handling, and teardown, structurally mirroring the WHEP lifecycle.
- Stop and navigation-away teardown prevent an active HLS session from lingering.
- A non-WebRTC protocol was added **without** introducing a shared media-session abstraction and **without** forcing HLS into a WebRTC-specific shape.
- TypeScript, lint, and Jest checks pass.
- The iOS workspace builds successfully and functional checks are completed where device and endpoint access permit.
- Android remains structurally valid and passes the selected Gradle configuration check.
