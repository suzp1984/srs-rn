# SRS RN RTMP Play Feature Design

**Date:** 2026-08-12
**Status:** Approved
**Builds on:** `docs/superpowers/specs/2026-07-25-srs-rn-unified-app-design.md`, `docs/superpowers/specs/2026-08-05-srs-rn-srt-design.md`, `docs/superpowers/specs/2026-08-05-srs-rn-dash-design.md`

## Objective

Add RTMP playback to the SRS RN application as a sixth protocol feature alongside WHIP, WHEP, HLS, SRT, and DASH. The work reuses the libVLC media stack (`react-native-vlc-media-player`) introduced by SRT and proven on device by DASH, and is the lowest-risk protocol addition yet: RTMP is the only play protocol besides HLS that SRS natively serves over its default port, and VLC's RTMP support is both **explicitly listed** in the library README and a **core VLC access module** (not an external library like libsrt).

RTMP publish (pushing camera+mic to SRS via RTMP) is out of scope: no React Native library supports it, and it is a separate native-module effort. This feature is **playback only** - a client pulling an RTMP stream from SRS.

## Project Identity and Scope

Added entirely inside the existing `SRSRN/` application. No new application, native project, dependency, or rename.

### Included

- A new `features/rtmp/` feature directory owning its URL-entry screen, player screen, validation, session hook, and types.
- A new launcher entry and two new typed navigation routes.
- An RTMP player built on the already-installed `react-native-vlc-media-player` (libVLC), which handles the RTMP handshake, segment pull, demux, and decode natively.
- The same explicit-Start, generation-guarded, idempotent-teardown session lifecycle used by the other features, adapted to libVLC's component-mounted player. As with SRT and DASH, libVLC exposes an imperative `stopPlayer()` ref method, so the RTMP hook performs a **true imperative cleanup**.
- Automated tests mirroring the SRT/DASH test suites, plus launcher and URL-entry coverage.
- iOS build verification and Android structural/Gradle verification.

### Excluded

- Modifying `features/whip/`, `features/whep/`, `features/hls/`, `features/srt/`, `features/dash/`, or the legacy `WHIPPublisher/` / `WHEPPlayer/` applications.
- Adding any new native dependency, pod, permission, or Gradle configuration. The RTMP feature reuses the `react-native-vlc-media-player` dependency, its jest mock, its type augmentation, the `MobileVLCKit` pod, `NSLocalNetworkUsageDescription`, and the Android `libc++_shared.so` workaround already added by the SRT feature.
- A shared media-session abstraction across features.
- Persisting the edited RTMP URL between launches (consistent with the other features).
- Allowing playback to continue in the background after navigation (consistent with the other features).
- RTMP publishing.
- Surfacing specific libVLC error text. libVLC's `onError` event carries only a `target` id, so user-visible RTMP errors are a generic "Playback error" (same accepted limitation as SRT/DASH).

## Media Stack

- **`react-native-vlc-media-player`** is the media stack - **not** a new dependency. It was added by SRT and proven on an iPhone by DASH (commit `632076c` + device verification 2026-08-12). Its jest mock and type augmentation are already in `jest.setup.js` and `types/react-native-vlc-media-player.d.ts`. The RTMP feature imports the same named `VLCPlayer` component and reuses the same `VLCPlayerInstance` ref type.
- The player is the `<VLCPlayer>` component, rendered by `RtmpPlayerScreen` and bound, via a ref, to the session hook. The ref exposes imperative methods including `stopPlayer()`, `seek()`, `resume()`.
- libVLC handles the RTMP handshake (with SRS), pulls the stream, demuxes, and decodes natively. It does not use AVPlayer, so it is not subject to AVPlayer's format limitations.
- **Viability (strongest of the VLC protocols):**
  - The package README explicitly lists RTMP twice: *"Support for network streams, RTSP, RTP, RTMP, HLS, MMS"* and *"Network protocols: ... RTMP ..."*, plus *"Network streaming formats: ... Flash RTMP ..."*. (SRT was the one format **not** listed, which is why SRT failed.)
  - VLC's RTMP support is a **core VLC access module** (`modules/access/rtmp/`), VLC's own code compiled into standard `MobileVLCKit` - not an external library like libsrt. This is the same structural situation as DASH, which was verified working on device.
  - No RTMP-specific native configuration exists in the package's podspec or Gradle (verified by grep).
- Compatibility with SRS's RTMP output remains the gating device check (see Verification), but the structural risk is lower than DASH (which already passed).

## Architecture

```text
SRSRN/
├── launcher/
│   └── features.ts            # +1 launcher entry
├── navigation/
│   ├── RootNavigator.tsx      # +2 Stack.Screen entries
│   └── types.ts               # +2 routes in RootStackParamList
├── screens/
│   └── HomeScreen.tsx         # unchanged layout (disabled-state rendering already in place)
└── features/
    └── rtmp/                  # new feature directory
        ├── RtmpUrlScreen.tsx
        ├── RtmpPlayerScreen.tsx
        ├── useRtmpSession.ts
        ├── validation.ts
        └── types.ts
```

Test files in `SRSRN/__tests__/`: `RtmpUrlScreen.test.tsx`, `RtmpPlayerScreen.test.tsx`, `rtmp-validation.test.ts`.

The feature owns its screens, validation, route-facing types, media lifecycle, and focused tests. It must be understandable and changeable without reading or modifying the other feature implementations.

## Launcher

A sixth entry is appended to `LAUNCHER_FEATURES`; no `HomeScreen` layout logic changes.

```text
id:           rtmp
title:        RTMP Play
description:  Play an RTMP stream from an SRS server via VLC.
actionLabel:  Open RTMP
color:        #be185d          (magenta/pink, distinct from WHIP blue, WHEP green, HLS amber, SRT purple, DASH teal)
destination:  RtmpUrl
```

The `LauncherDestination` union gains `'RtmpUrl'`.

## Navigation

```text
Home
├── WhipUrl  -> Publisher
├── WhepUrl  -> Player
├── HlsUrl   -> HlsPlayer
├── SrtUrl   -> SrtPlayer   (launcher entry disabled - SRT non-functional)
├── DashUrl  -> DashPlayer
└── RtmpUrl  -> RtmpPlayer
```

`RootStackParamList` gains:

- `RtmpUrl: undefined`
- `RtmpPlayer: {rtmpUrl: string}`

The RTMP URL is passed from `RtmpUrlScreen` to `RtmpPlayerScreen` as a typed route parameter. Other routes and defaults remain unchanged.

Only one media screen can be mounted at a time. Returning from `RtmpPlayerScreen` unmounts it and triggers complete session teardown.

## RTMP Playback Flow

1. From Home, the user selects RTMP Play.
2. `RtmpUrlScreen` displays an editable field initialized with `DEFAULT_RTMP_URL`.
3. The screen accepts only syntactically valid `rtmp://` URLs.
4. A valid submission navigates to `RtmpPlayerScreen` with the URL as a typed route parameter.
5. `RtmpPlayerScreen` starts only when the user presses Start.
6. Start creates a uniquely identified session attempt and renders `<VLCPlayer source={{uri: rtmpUrl}} autoplay paused={false}>` bound to the hook's player ref.
7. libVLC performs the RTMP handshake with SRS, pulls the stream, and decodes it natively. `onPlaying` transitions the attempt to active; `onError` transitions it to error.
8. Stop, navigation away, unmount, retry, or startup failure marks the attempt obsolete, calls `stopPlayer()` on the ref, and unmounts the `<VLCPlayer>`.
9. After cancellation or failure, a still-mounted screen is ready for a fresh Start.
10. No session remains active after leaving `RtmpPlayerScreen`.

## Session Lifecycle

`useRtmpSession()` mirrors `useDashSession` / `useSrtSession` (same VLC media stack, same imperative `stopPlayer()` ref method, same `onPlaying`/`onError` callbacks, same `{target}`-only error payload). It is structurally identical to `useDashSession` with naming changes; the behavioral difference is only the URL scheme accepted upstream by `validateRtmpUrl`.

The lifecycle rules are identical to DASH/SRT: explicit Start guarded against duplicate requests; each Start creates one uniquely identified attempt; Stop/navigation/unmount/retry/failure marks the attempt obsolete before cleanup; an obsolete attempt must not mutate state; non-abortable libVLC operations may settle but their late callbacks are dropped by the `isCurrent(attempt)` guard; cleanup calls `playerRef.current.stopPlayer()` and is idempotent (guarded by a `closed` flag); the subsequent status -> `idle` transition unmounts `<VLCPlayer>`; partial setup is cleaned up on failure; a stale attempt cannot interfere with a newer attempt's player; after cancellation/failure the screen is ready for a fresh Start; no session lingers after leaving the screen.

### Attempt shape

```text
RTMP attempt: { id, closed }
```

No `pc`, `stream`, or `abort` - libVLC pulls the RTMP stream internally; the `closed`/`isCurrent` guard honors the non-abortable-settles-and-is-ignored rule.

### Imperative cleanup

Identical to SRT/DASH: `cleanupAttempt` calls `playerRef.current?.stopPlayer()` before the status -> `idle` unmount.

## Error Handling

Same policy as the other features, without sharing implementation code:

- Invalid URLs are rejected on the URL-entry screen and do not navigate.
- Player errors (unreachable server, rejected RTMP handshake, decode failure) arrive via `onError` and are reported only if the owning attempt is current.
- libVLC's `onError` payload is `{target: number}` with no message field, so the user-visible message is the generic `'Playback error'`.
- Resources acquired before a failure are released before retry.
- A failed start leaves the user on `RtmpPlayerScreen`, recoverable without restarting the app.

## Native Configuration

**None new.** RTMP reuses, unchanged, everything SRT installed and DASH reused:

- Dependency `react-native-vlc-media-player` `1.0.98`, iOS `MobileVLCKit` pod, type augmentation, jest mock, `NSLocalNetworkUsageDescription`, Android `libc++_shared.so` workaround - all already in place.
- ATS is irrelevant to RTMP (RTMP is its own protocol on port 1935, not HTTP). The existing `NSAllowsLocalNetworking` covers the HTTP-based defaults and is unchanged.
- No new capture permissions (play-only).

## URL Entry and Validation

- `DEFAULT_RTMP_URL = 'rtmp://192.168.1.100:1935/live/livestream'` - the SRS RTMP play endpoint, matching the host (`192.168.1.100`) and app/stream (`live`/`livestream`) used by the other defaults. RTMP's default port is 1935. SRS serves RTMP play at `rtmp://host:1935/app/stream`.
- `validateRtmpUrl` mirrors `validateSrtUrl` in shape: trim, reject empty, parse as `URL`, require the `rtmp:` protocol. It does **not** enforce the app/stream path - validation stays syntactic. `new URL('rtmp://...')` parses `rtmp` as a non-special scheme; scheme validation gates acceptance.
- `RtmpUrlScreen` mirrors `SrtUrlScreen`/`DashUrlScreen`: editable `TextInput` seeded with `DEFAULT_RTMP_URL`, inline error feedback, navigation to `RtmpPlayer` with `{rtmpUrl: result.url}`. Test IDs: `rtmp-url-input`, `rtmp-url-error`, `rtmp-url-connect`.

## Testing

### Home Screen
- The RTMP card renders from `LAUNCHER_FEATURES` alongside the others.
- The RTMP card navigates to `RtmpUrl`.
- A seventh launcher entry can still be rendered without layout changes (the synthetic extra entry's id must be renamed from `rtmp` to a non-colliding id, since the real `rtmp` entry this feature adds would collide on `keyExtractor`).

### URL Entry
- Displays `DEFAULT_RTMP_URL`; keeps it editable; shows feedback for invalid input; does not navigate with invalid input; navigates with the exact valid URL as a typed parameter; does not use or overwrite other features' defaults.

### Validation
- Rejects empty/non-URL/non-`rtmp` schemes (e.g. `http://`, `srt://`, `ftp://`); accepts valid `rtmp://` URLs including `DEFAULT_RTMP_URL`.

### Player Screen and Session Hook
- No `<VLCPlayer>` before Start; rapid repeated Start creates one attempt; Stop/unmount during loading leaves no session and calls `stopPlayer()`; late `onPlaying`/`onError` from an obsolete attempt is dropped; cleanup is idempotent (Stop + unmount + late events don't throw/double-clean); a failed start leaves the screen ready for a fresh Start; a player error produces a user-visible recoverable "Playback error".

### App Navigation
- `RtmpUrl` and `RtmpPlayer` mount through the unified navigator; Home remains the initial route.

## Verification

Run all commands inside `SRSRN/`.

1. TypeScript checking. 2. ESLint. 3. Jest (including new RTMP suites). 4. iOS workspace build (no new pods). 5. Android Gradle configuration check.

**Gating device check:** RTMP is explicitly listed by the library and is a core VLC access module, so the structural risks that sank SRT (libsrt external library) do not apply, and the risk is lower than DASH (which passed). An actual `rtmp://` stream **must** still be played on a device to confirm libVLC's RTMP handshake works against SRS. Do not claim RTMP playback was verified unless a stream was actually observed playing.

If a device or reachable SRS endpoint is unavailable, complete all automated and native build checks and explicitly report the remaining manual steps.

## Acceptance Criteria

- `features/rtmp/` is a clean, independent feature directory.
- `features/whip/`, `features/whep/`, `features/hls/`, `features/srt/`, `features/dash/`, and the legacy apps remain unchanged.
- Home renders the RTMP card from launcher configuration with no `HomeScreen` layout change.
- The RTMP flow preserves an editable default URL, explicit Start, native playback, error handling, and teardown, mirroring the SRT/DASH lifecycle with a true imperative `stopPlayer()` cleanup.
- No new native dependency, pod, permission, or Gradle configuration was added.
- Stop and navigation-away teardown prevent an active RTMP session from lingering.
- TypeScript, lint, and Jest checks pass; iOS workspace builds; Android Gradle configuration resolves.
- **RTMP-via-VLC is verified to play an actual `rtmp://` stream on a device.**
