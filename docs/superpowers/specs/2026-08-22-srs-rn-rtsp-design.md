# SRS RN RTSP Play Feature Design

**Date:** 2026-08-22
**Status:** Draft
**Builds on:** `docs/superpowers/specs/2026-07-25-srs-rn-unified-app-design.md`, `docs/superpowers/specs/2026-07-26-srs-rn-hls-play-design.md`, `docs/superpowers/specs/2026-08-05-srs-rn-dash-design.md`, `docs/superpowers/specs/2026-08-12-srs-rn-rtmp-design.md`

## Objective

Add RTSP playback to the SRS RN application alongside the existing play features. The work reuses the libVLC media stack (`react-native-vlc-media-player`) already in use by SRT, DASH, RTMP, FLV, and HTTP-TS, and is the lowest-risk protocol addition since DASH: RTSP is a **core VLC access module** (in `modules/access/live555.cpp`, the same Live555-based pipeline that powers SDP and RTP), explicitly listed as supported by the `react-native-vlc-media-player` README, and requires **no** external library such as libsrt (the structural defect that kept SRT disabled).

RTSP publish (pushing camera+mic to an RTSP server) is out of scope: the only RN libraries that do this are vendor-specific (e.g. RTSP-specific forks), and it is a separate native-module effort. This feature is **playback only** — a client pulling an RTSP stream.

## Project Identity and Scope

The feature is added entirely inside the existing `SRSRN/` application. There is no new application, native project, dependency, or rename.

### Included

- A new `features/rtsp/` feature directory owning its URL-entry screen, player screen, validation, session hook, and types.
- A new launcher entry and two new typed navigation routes.
- An RTSP player built on the already-installed `react-native-vlc-media-player` (libVLC), which handles the RTSP DESCRIBE / SETUP / PLAY handshake, SDP parsing, RTP packet reception, depayloading, demux, and decode natively.
- The same explicit-Start, generation-guarded, idempotent-teardown session lifecycle policy used by HLS, SRT, DASH, RTMP, FLV, and HTTP-TS, adapted to libVLC's component-mounted player. As with the other VLC-based features, libVLC exposes an imperative `stopPlayer()` ref method, so the RTSP hook performs a **true imperative cleanup**.
- Automated tests mirroring the DASH/RTMP/FLV/TS test suites, plus launcher and URL-entry coverage.
- iOS build verification and Android structural/Gradle verification.

### Excluded

- Modifying `features/whip/`, `features/whep/`, `features/hls/`, `features/srt/`, `features/dash/`, `features/rtmp/`, `features/rtmp_publish/`, `features/flv/`, `features/ts/`, or the legacy `WHIPPublisher/` / `WHEPPlayer/` applications.
- Adding any new native dependency, pod, permission, or Gradle configuration. The RTSP feature reuses `react-native-vlc-media-player`, its jest mock, its type augmentation, the `MobileVLCKit` pod, `NSLocalNetworkUsageDescription`, and the Android `libc++_shared.so` workaround already added by SRT and reused by DASH, RTMP, FLV, and HTTP-TS.
- A shared media-session abstraction across features. The unified-app spec explicitly excludes this, and this feature must not introduce one.
- Persisting the edited RTSP URL between launches (consistent with the other features).
- Allowing playback to continue in the background after navigation (consistent with the other features).
- RTSP publish / pushing from the device.
- Supporting `rtsps://` (RTSP over TLS). Only `rtsp://` is in scope. `rtsps://` is rejected by the URL validator with a clear error.
- Supporting an auth-fields UI in the URL screen. URL-embedded credentials (`rtsp://user:pass@host/path`) are accepted; there is no separate username/password form. This matches the rest of the app.
- Surfacing specific libVLC error text. libVLC's `onError` event carries only a `target` id and no message field, so user-visible RTSP errors are a generic "Playback error". This is the same accepted limitation as SRT/DASH/RTMP/FLV/TS.
- Requiring Android emulator or physical-device runtime verification (consistent with the other features).

## Architecture

The feature follows the feature-based structure established by the unified application and mirrored by every play-feature added since:

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
    └── rtsp/                  # new feature directory
        ├── RtspUrlScreen.tsx
        ├── RtspPlayerScreen.tsx
        ├── useRtspSession.ts
        ├── validation.ts
        └── types.ts
```

Test files follow the existing `SRSRN/__tests__/` placement: `RtspUrlScreen.test.tsx`, `RtspPlayerScreen.test.tsx`, and `rtsp-validation.test.ts`.

The feature owns its screens, validation, route-facing types, media lifecycle, and focused tests. It must be understandable and changeable without reading or modifying any of the other play-feature implementations.

## Media Stack

- **`react-native-vlc-media-player`** is the media stack. It is **not** a new dependency: it was added by the SRT feature, is already in `package.json`, `node_modules`, the iOS `Podfile.lock` (`MobileVLCKit`), and the Android Gradle config (`libc++_shared.so` workaround), and has been verified working on device for DASH, RTMP, FLV, and HTTP-TS playback. Its jest mock and type augmentation are already in `jest.setup.js` and `types/react-native-vlc-media-player.d.ts`. The RTSP feature imports the same named `VLCPlayer` component and reuses the same `VLCPlayerInstance` ref type.
- The player is the `<VLCPlayer>` component, rendered by `RtspPlayerScreen` and bound, via a ref, to the session hook. The ref exposes imperative methods including `stopPlayer()`, `seek()`, and `resume()`.
- libVLC handles the RTSP handshake (DESCRIBE / SETUP / PLAY with the server), SDP parsing, RTP packet reception, depayloading, demultiplexing, and decode natively. It does not use AVPlayer, so it is not subject to AVPlayer's HLS-only limitation.
- The feature uses no `react-native-webrtc` primitives, no `getUserMedia`, no `react-native-video`. There is no peer connection, no SDP exchange with a browser, and no camera or microphone access.
- **Viability (strongest of the VLC protocols after DASH/RTMP):**
  - The `react-native-vlc-media-player` README explicitly lists RTSP as a supported protocol.
  - VLC's RTSP support is a **core VLC access module** (`modules/access/live555.cpp`, the Live555-based pipeline), VLC's own code compiled into standard `MobileVLCKit` — not an external library like libsrt. This is the same structural situation as DASH/RTMP, which were verified working on device.
  - No RTSP-specific native configuration exists in the package's podspec or Gradle (verified by grep against `node_modules/react-native-vlc-media-player/`).
- Compatibility with SRS's RTSP output remains the gating device check (see Verification), but the structural risk is the lowest of the seven play protocols added so far.

## Launcher

The Home screen's two-column grid renders from `LAUNCHER_FEATURES`. A tenth entry is appended; no `HomeScreen` layout logic changes.

The new launcher entry:

```text
id:           rtsp
title:        RTSP Play
description:  Play an RTSP stream from an SRS server via VLC.
actionLabel:  Open RTSP
color:        #475569          (slate, distinct from WHIP blue, WHEP green, HLS amber, SRT purple, DASH teal, RTMP magenta, RTMP-Publish indigo, FLV dark-teal, HTTP-TS green)
destination:  RtspUrl
```

The `LauncherDestination` union gains `'RtspUrl'`. The launcher configuration remains limited to presentation and routing; it defines no connection, transport, or media-session interface.

## Navigation

One typed native-stack navigator, extended with two routes:

```text
Home
├── WhipUrl         -> Publisher
├── WhepUrl         -> Player
├── HlsUrl          -> HlsPlayer
├── SrtUrl          -> SrtPlayer   (launcher entry disabled - SRT non-functional)
├── DashUrl         -> DashPlayer
├── RtmpUrl         -> RtmpPlayer
├── RtmpPublishUrl  -> RtmpPublisher
├── FlvUrl          -> FlvPlayer
├── TsUrl           -> TsPlayer
└── RtspUrl         -> RtspPlayer
```

`RootStackParamList` gains:

- `RtspUrl: undefined`
- `RtspPlayer: {rtspUrl: string}`

The RTSP URL is passed from `RtspUrlScreen` to `RtspPlayerScreen` as a typed route parameter, exactly as the other features pass theirs. All other routes and defaults remain independent and unchanged.

The route is named `RtspPlayer` (prefixed for clarity, matching the `HlsPlayer` / `SrtPlayer` / `DashPlayer` / `RtmpPlayer` / `FlvPlayer` / `TsPlayer` convention). The existing player screens are not renamed.

Only one media screen can be mounted at a time. Returning from `RtspPlayerScreen` unmounts it and triggers complete session teardown before the user opens another feature, consistent with the other media screens.

## RTSP Playback Flow

1. From Home, the user selects RTSP Play.
2. `RtspUrlScreen` displays an editable field initialized with `DEFAULT_RTSP_URL`.
3. The screen accepts only syntactically valid `rtsp://` URLs (with required host and non-empty path).
4. A valid submission navigates to `RtspPlayerScreen` with the URL as a typed route parameter.
5. `RtspPlayerScreen` starts only when the user presses Start. Entering the screen does not create a player or begin loading.
6. Start creates a uniquely identified session attempt and renders `<VLCPlayer source={{uri: rtspUrl}} autoplay paused={false}>` bound to the hook's player ref.
7. libVLC performs the RTSP DESCRIBE / SETUP / PLAY handshake with the server, parses the SDP, pulls the RTP media streams, and decodes them natively. `onPlaying` transitions the attempt to active; `onError` transitions it to error.
8. Stop, navigation away, unmount, retry, or startup failure marks the attempt obsolete, calls `stopPlayer()` on the ref, and unmounts the `<VLCPlayer>`.
9. After cancellation or failure, a still-mounted screen is ready for a fresh Start.
10. No session remains active after leaving `RtspPlayerScreen`.

## Session Lifecycle

`useRtspSession()` mirrors `useFlvSession` / `useTsSession` (the closest analogues — same VLC media stack, same imperative `stopPlayer()` ref method, same `onPlaying` / `onError` callbacks, same `{target}`-only error payload). It is structurally identical to `useFlvSession` with only naming changes; the one behavioral difference is the URL scheme accepted upstream by `validateRtspUrl`.

Each media screen owns its session state; there is no global player.

The lifecycle rules:

- Start is explicit and guarded against duplicate requests. A second concurrent session cannot be started from the same screen.
- Each accepted Start creates one uniquely identified session attempt.
- Stop, navigation away, unmount, retry, or startup failure marks the current attempt obsolete before cleanup begins.
- An obsolete attempt must not transition status, install a player, report a result to the current UI, or otherwise update screen state.
- The player's internal RTSP handshake and RTP stream cannot be aborted by the application. Per the unified-app lifecycle policy, operations that cannot be aborted may settle, but their results are ignored: late `onPlaying` / `onError` / `onLoad` callbacks from an obsolete attempt are dropped by the `isCurrent(attempt)` guard rather than acted on.
- Cleanup stops and releases the attempt's player via `playerRef.current.stopPlayer()`, marks the attempt closed, and is safe to invoke more than once (idempotent, guarded by a `closed` flag). The subsequent status -> `idle` transition unmounts `<VLCPlayer>`, releasing the native player.
- Partial setup is cleaned up if any later step fails.
- A stale attempt cannot stop, replace, or otherwise interfere with a player owned by a newer attempt.
- After cancellation or failure, a still-mounted screen is ready for a fresh Start.
- No session remains active after leaving `RtspPlayerScreen`.

### Attempt shape

The RTSP attempt mirrors the FLV / TS / DASH / SRT / RTMP attempt:

```text
RTSP attempt: { id, closed }
```

- `id` and `closed` carry over unchanged from the other VLC-based features.
- There is no `pc` (no PeerConnection), no `stream` (no `MediaStream`), and no `abort` (no application-controlled fetch). libVLC performs the RTSP handshake and pulls RTP packets internally; the `closed` / `isCurrent` guard honors the non-abortable-settles-and-is-ignored rule.

The hook owns a `playerRef` (a `React.useRef` holding the `VLCPlayer` instance). `RtspPlayerScreen` attaches that ref to the rendered `<VLCPlayer>` and wires the hook's `onPlaying` / `onError` callbacks, each guarded by `isCurrent(attempt)` before it mutates state. The per-attempt `onPlaying` / `onError` closures are stored in a `handlers` state variable so a stale attempt's late event short-circuits via `isCurrent(attempt)` capturing that attempt — the same ownership split the other VLC-based features use.

### Imperative cleanup

Identical to the other VLC-based features: `cleanupAttempt` calls `playerRef.current?.stopPlayer()` before the status -> `idle` unmount. This is a real imperative stop, structurally close to WHEP's `pc.close()`. The `closed` flag plus `isCurrent(attempt)` guard still drops any late `onPlaying` / `onError` that arrive after cleanup begins.

## Error Handling

The feature follows the same policy as the other play features, without sharing implementation code:

- Invalid URLs are rejected on the URL-entry screen and do not navigate.
- Player errors (unreachable server, rejected RTSP handshake, SDP parse failure, unsupported codec, decode failure) arrive asynchronously via `onError` and are reported only if the owning attempt is still current.
- libVLC's `onError` event payload is `{target: number}` with no message field, so the user-visible message is the generic `'Playback error'` — identical to SRT/DASH/RTMP/FLV/TS. The hook does not fabricate a more specific message. Development logs are the avenue for deeper diagnosis.
- Any resources acquired before a failure are released before retry.
- A failed start leaves the user on `RtspPlayerScreen`, where they can retry or navigate back.
- Unreachable-server and player-error states must be recoverable without restarting the application.

## Native Configuration

### None new

The RTSP feature adds **no** native configuration. It reuses, unchanged, everything SRT installed and the six subsequent play features reused:

- **Dependency:** `react-native-vlc-media-player` `1.0.98` is already in `package.json`.
- **iOS pod:** `MobileVLCKit` is already in `Podfile.lock` and installed.
- **Type augmentation:** `types/react-native-vlc-media-player.d.ts` already exports the named `VLCPlayer` and `VLCPlayerInstance` type.
- **jest mock:** `jest.setup.js` already mocks `react-native-vlc-media-player` with `__mockVlcInstances`, `__resetVlcMocks`, and `__fireOnPlaying` / `__fireOnError` / `__fireOnLoad`.
- **iOS permission:** `NSLocalNetworkUsageDescription` is already in `ios/SRSRN/Info.plist` (added by SRT for local-network playback; RTSP defaults also target `192.168.1.100`).
- **App Transport Security:** RTSP is not HTTP, so the existing `NSAllowsLocalNetworking` is irrelevant to RTSP traffic itself, but the entry is unchanged. No new ATS rule is needed.
- **Android Gradle:** the `libc++_shared.so` merge workaround is already in `android/app/build.gradle`. No change.
- **Android permissions:** none added (play-only, no capture; `INTERNET` is already declared and covers UDP/TCP egress used by RTSP).

## URL Entry and Validation

- `DEFAULT_RTSP_URL = 'rtsp://192.168.1.100:554/live/livestream'` — the SRS RTSP endpoint, matching the host (`192.168.1.100`) and app/stream (`live` / `livestream`) used by the other defaults. RTSP's default port is 554, so it is included explicitly. SRS serves RTSP at `rtsp://host:554/app/stream` when the RTSP ingest module is enabled (`rtmp { enabled on; }` in older configs, or via SRS 6+ which embeds RTSP into the RTMP module).
- `validateRtspUrl` mirrors `validateRtmpUrl` / `validateSrtUrl` in shape, with the additional `rtsp://`-specific structural rules below:
  1. Trim the input; reject empty.
  2. Parse as `URL`. Reject on parse failure.
  3. Require the `rtsp:` protocol. **Reject `rtsps://`** with a specific message (`'rtsps:// (RTSP over TLS) is not supported'`). Reject all other schemes (e.g. `http://`, `rtmp://`, `srt://`, `ftp://`).
  4. Require a non-empty host (`parsed.hostname` is truthy).
  5. Require a non-empty path (`parsed.pathname` is at least `'/'`). An empty pathname fails the check; a bare `/` is acceptable. This distinguishes RTSP URLs from generic connection strings and aligns with how every RTSP server identifies a stream.
  6. URL-embedded userinfo (`rtsp://user:pass@host/path`) is accepted and forwarded as-is. The hook does not parse or rewrite credentials; libVLC extracts them from the URL itself.
  7. The protocol check is case-insensitive in spirit (the WHATWG `URL` parser lowercases the scheme), so `RTSP://...` is accepted.
  8. The `.url` returned on success is the trimmed input, not a re-serialization, so user-entered casing of the path and query is preserved.
- `RtspUrlScreen` mirrors `HlsUrlScreen` / `SrtUrlScreen` / `DashUrlScreen` / `RtmpUrlScreen` / `FlvUrlScreen` / `TsUrlScreen`: an editable `TextInput` seeded with `DEFAULT_RTSP_URL`, inline error feedback, and navigation to `RtspPlayer` with `{rtspUrl: result.url}` on valid submit. Test IDs: `rtsp-url-input`, `rtsp-url-error`, `rtsp-url-connect`.

## Testing

### Home Screen

- The RTSP card renders from `LAUNCHER_FEATURES` alongside the other nine.
- The RTSP card navigates to `RtspUrl`.
- The existing "renders an additional launcher entry without layout changes" test continues to pass with a synthetic entry whose id does not collide with `rtsp` (the synthetic id used today — `future_proto` — already does not collide).

### URL Entry

- Displays `DEFAULT_RTSP_URL`.
- Keeps the URL editable.
- Shows feedback for invalid input.
- Does not navigate with invalid input.
- Navigates with the exact valid URL as a typed parameter.
- Does not use or overwrite any other feature's default.

### Validation

- Rejects empty input.
- Rejects non-URL input.
- Rejects `rtsps://` (RTSP over TLS) with the specific message above.
- Rejects non-`rtsp` schemes (`http://`, `https://`, `rtmp://`, `srt://`, `ftp://`).
- Rejects `rtsp://host` (no path).
- Accepts `rtsp://host/` (path is `/`).
- Accepts `rtsp://host/path`, `rtsp://host:554/path`, `rtsp://user:pass@host:554/path?q=1`, and `RTSP://HOST/PATH` (case-insensitive scheme).
- Accepts `DEFAULT_RTSP_URL`.

### Player Screen and Session Hook

- No `<VLCPlayer>` is rendered and no session exists before Start.
- Rapid repeated Start presses create only one attempt.
- Stop and unmount during player loading leave no active session, and `stopPlayer()` is called on the ref.
- A late `onPlaying` or `onError` from an obsolete attempt does not update UI state or replace a newer attempt's state.
- Cleanup after failure, Stop, and unmount is idempotent (Stop + unmount + late events do not throw or double-clean).
- A failed start (`onError`) leaves the screen ready for a fresh Start.
- A player error produces a user-visible, recoverable message (generic "Playback error").

### App Navigation

- `RtspUrl` and `RtspPlayer` mount through the unified navigator.
- Home remains the initial route.

## Verification

Run all commands inside `SRSRN/`, because it is an independent application.

Required automated and build checks:

1. Run TypeScript checking.
2. Run ESLint.
3. Run Jest, including the new RTSP suites.
4. Build the iOS workspace (no new pods; `pod install` should be a no-op but is run to confirm).
5. Run an Android Gradle configuration check (no new Gradle config; the existing `libc++_shared.so` workaround applies).

Required iOS functional checks (when a device and a reachable RTSP endpoint are available):

1. Launch into Home and confirm the RTSP card is present.
2. Open RTSP, retain or edit the URL, press Start, receive RTSP playback, and stop cleanly.
3. Return Home mid-playback and confirm playback has ended.
4. Confirm an unreachable server, an RTSP 404, a malformed SDP, and a decode error each produce an understandable, recoverable message (generic "Playback error").

**Gating device check:** RTSP is a core VLC access module (not an external library like libsrt) and is explicitly listed as supported by the library, so the structural risk that sank SRT does not apply. However, RTSP handshake compatibility with SRS's specific RTSP server output is unverified. An actual `rtsp://` stream **must** be played on a device to confirm libVLC's RTSP pipeline negotiates and decodes SRS's output. If RTSP playback does not work, this approach fails and the project reconsiders (a different RTSP-capable player, or a different protocol). Do not claim RTSP playback was verified unless a stream was actually observed playing.

If a physical device or reachable RTSP endpoint is unavailable, complete all possible automated and native build checks and explicitly report the remaining manual steps. Do not claim endpoint-dependent behavior was verified when it was not observed.

## Acceptance Criteria

The work is complete when:

- `features/rtsp/` is a clean, independent feature directory with its own URL-entry screen, player screen, validation, session hook, and types.
- `features/whip/`, `features/whep/`, `features/hls/`, `features/srt/`, `features/dash/`, `features/rtmp/`, `features/rtmp_publish/`, `features/flv/`, `features/ts/`, and the legacy `WHIPPublisher/` / `WHEPPlayer/` applications remain unchanged.
- Home renders the RTSP card from launcher configuration with no change to `HomeScreen` layout logic.
- The RTSP flow preserves an editable default URL, explicit Start, native playback, error handling, and teardown, structurally mirroring the FLV/TS/DASH/SRT/RTMP lifecycle, with a true imperative `stopPlayer()` cleanup.
- `validateRtspUrl` accepts `rtsp://` URLs (including URL-embedded credentials) and rejects `rtsps://` and all other schemes.
- No new native dependency, pod, permission, or Gradle configuration was added — the feature reuses the libVLC infrastructure already installed for SRT/DASH/RTMP/FLV/TS.
- Stop and navigation-away teardown prevent an active RTSP session from lingering.
- A new VLC-based play protocol was added **without** introducing a shared media-session abstraction and **without** redesigning Home.
- TypeScript, lint, and Jest checks pass.
- The iOS workspace builds successfully and functional checks are completed where device and endpoint access permit.
- Android remains structurally valid and passes the selected Gradle configuration check.
- **RTSP-via-VLC is verified to play an actual `rtsp://` stream on a device.**
