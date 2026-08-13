# SRS RN RTMP Publish Feature Design

**Date:** 2026-08-12
**Status:** Approved (experimental - unmaintained dependency)
**Builds on:** `docs/superpowers/specs/2026-07-25-srs-rn-unified-app-design.md`, `docs/superpowers/specs/2026-08-12-srs-rn-rtmp-design.md` (RTMP play)

## Objective

Add RTMP **publish** (camera+microphone pushed to SRS via RTMP) as a seventh protocol feature alongside WHIP publish, WHEP/HLS/SRT/DASH/RTMP play. This is the second publish protocol (WHIP being the first) and the first to use a non-WebRTC publish stack.

**This is an experimental feature.** The only React Native RTMP publisher on npm is `react-native-rtmp-publisher` (v0.4.7), whose README explicitly warns *"THIS PACKAGE CURRENTLY UNMAINTAINED"* and which was last published 2023-01-21 (RN 0.71 era, legacy bridge). It was chosen after a survey showed no maintained alternative, and a timeboxed install + `pod install` + iOS simulator build **succeeded** on RN 0.86 (the new-architecture interop layer carried the legacy `RCTBridgeModule`; HaishinKit 1.2.7 compiled and linked). Build success is necessary but not sufficient: actual RTMP publish to SRS on a device is the gating check, and because the package is unmaintained, the risk of a runtime failure is higher than for the play features.

## Project Identity and Scope

Added entirely inside the existing `SRSRN/` application. No new application or rename.

### Included

- A new `features/rtmp_publish/` feature directory owning its URL-entry screen, publisher screen, validation, session hook, and types.
- A new launcher entry and two new typed navigation routes.
- An RTMP publisher built on `react-native-rtmp-publisher` (which wraps HaishinKit 1.2.7 on iOS), capturing camera+microphone and pushing an RTMP stream to SRS.
- The same explicit-Start, generation-guarded, idempotent-teardown session lifecycle used by the other features, adapted to the `<RTMPPublisher>` component's imperative `startStream()`/`stopStream()` ref methods and connection callbacks.
- An `AppDelegate.swift` AVAudioSession setup (PlayAndRecord category) required by the library for audio capture.
- A jest mock for `react-native-rtmp-publisher` so the session hook and screen are testable.
- Automated tests mirroring the WHIP publisher / play-feature test suites, plus launcher and URL-entry coverage.
- iOS build verification and Android structural/Gradle verification.

### Excluded

- Modifying `features/whip/`, `features/whep/`, `features/hls/`, `features/srt/`, `features/dash/`, `features/rtmp/` (play), or the legacy `WHIPPublisher/` / `WHEPPlayer/` applications.
- A shared media-session abstraction across features.
- Persisting the edited URL between launches (consistent with the other features).
- Allowing publishing to continue in the background after navigation (consistent with the other features).
- RTMP play (already implemented in `features/rtmp/`).
- Surfacing specific HaishinKit error text beyond what the library's callbacks provide. The `onConnectionFailed` callback carries a string; other failures fall back to a generic message.

## Media Stack

- **`react-native-rtmp-publisher` 1.0.98... 0.4.7** (pinned exact) is the one new native dependency. It is a legacy-`RCTBridgeModule` wrapper around **HaishinKit 1.2.7** (iOS, Swift) and a Java RTMP publisher (Android). It ships its own TypeScript types (`lib/typescript/index.d.ts`), so no local type augmentation is needed.
- The publisher is the `<RTMPPublisher>` component (a `forwardRef`), rendered by `RtmpPublisherScreen` and bound, via a ref, to the session hook. The ref (`RTMPPublisherRefProps`) exposes imperative methods: `startStream()`, `stopStream()`, `mute()`, `unmute()`, `switchCamera()`, `toggleFlash()`, `isStreaming()`, etc.
- Props: `streamURL` (e.g. `rtmp://host:1935/app`), `streamName` (e.g. `livestream`), and connection callbacks: `onConnectionStarted`, `onConnectionSuccess`, `onConnectionFailed(data: string)`, `onDisconnect`, `onNewBitrateReceived`, `onStreamStateChanged(StreamState)`.
- The `<RTMPPublisher>` component is both the camera preview and the publisher (it renders a native view). It is mounted when the session is active; `startStream()` is called after mount to begin the RTMP push.
- **Viability:** the package builds on RN 0.86 (verified). The package README lists RTMP publish as its purpose. HaishinKit 1.2.7 is a real RTMP publish library. The gating risk is runtime: whether the legacy-bridge module and HaishinKit 1.2.7 actually publish to SRS on a device under RN 0.86's new-arch interop. Device verification is required.

## Architecture

```text
SRSRN/
├── package.json                              # +react-native-rtmp-publisher 0.4.7 (exact) (Task 1)
├── package-lock.json                         # updated (Task 1)
├── jest.setup.js                             # +jest.mock('react-native-rtmp-publisher') (Task 1)
├── ios/SRSRN/AppDelegate.swift               # +AVAudioSession PlayAndRecord (Task 1)
├── ios/Podfile.lock                          # +HaishinKit 1.2.7 (Task 1)
├── launcher/
│   └── features.ts                           # +1 launcher entry (Task 4)
├── navigation/
│   ├── RootNavigator.tsx                    # +2 Stack.Screen (Task 4)
│   └── types.ts                             # +2 routes (Task 2)
└── features/
    └── rtmp_publish/                         # new feature directory
        ├── validation.ts                     # Task 2
        ├── RtmpPublishUrlScreen.tsx          # Task 2
        ├── types.ts                          # Task 3
        ├── useRtmpPublisherSession.ts        # Task 3
        └── RtmpPublisherScreen.tsx           # Task 3
```

Test files in `SRSRN/__tests__/`: `RtmpPublishUrlScreen.test.tsx`, `RtmpPublisherScreen.test.tsx`, `rtmp-publish-validation.test.ts`.

## Launcher

A seventh entry appended to `LAUNCHER_FEATURES`; no `HomeScreen` layout logic changes.

```text
id:           rtmp_publish
title:        RTMP Publish
description:  Publish camera and microphone to an SRS server via RTMP.
actionLabel:  Open RTMP Pub
color:        #4338ca          (indigo, distinct from RTMP Play magenta and the other five)
destination:  RtmpPublishUrl
```

The `LauncherDestination` union gains `'RtmpPublishUrl'`.

## Navigation

`RootStackParamList` gains:

- `RtmpPublishUrl: undefined`
- `RtmpPublisher: {rtmpUrl: string}`

The RTMP URL is passed from `RtmpPublishUrlScreen` to `RtmpPublisherScreen` as a typed route parameter. The screen splits it into `streamURL` (everything before the last `/`) and `streamName` (the last path segment) for the `<RTMPPublisher>` props.

## RTMP Publish Flow

1. From Home, the user selects RTMP Publish.
2. `RtmpPublishUrlScreen` displays an editable field initialized with `DEFAULT_RTMP_PUBLISH_URL`.
3. The screen accepts only syntactically valid `rtmp://` URLs.
4. A valid submission navigates to `RtmpPublisherScreen` with the URL.
5. `RtmpPublisherScreen` starts only when the user presses Start. Entering the screen does not begin capture or publishing.
6. Start creates a uniquely identified session attempt, mounts `<RTMPPublisher streamURL streamName ref callbacks>`, and calls `startStream()` on the ref once mounted.
7. HaishinKit performs the RTMP handshake with SRS and pushes the encoded camera+mic stream. `onConnectionStarted`/`onConnectionSuccess` transition the attempt to active; `onConnectionFailed` transitions it to error.
8. Stop, navigation away, unmount, retry, or startup failure marks the attempt obsolete, calls `stopStream()` on the ref, and unmounts the `<RTMPPublisher>`.
9. After cancellation or failure, a still-mounted screen is ready for a fresh Start.
10. No session remains active after leaving `RtmpPublisherScreen`.

## Session Lifecycle

`useRtmpPublisherSession()` mirrors the structure and guarantees of `useWhipSession` (the closest analogue - both are publish features with imperative resource lifecycle) and the play hooks' generation-guarded pattern. It is adapted to the `<RTMPPublisher>` component: the attempt owns the streaming state, the imperative `startStream()`/`stopStream()` ref methods replace `pc.close()`/`stream.stop()`, and the connection callbacks (per-attempt, `isCurrent`-guarded) replace the SDP offer/answer flow.

The lifecycle rules are the same as the other features: explicit Start guarded against duplicate requests; each Start creates one uniquely identified attempt; Stop/navigation/unmount/retry/failure marks the attempt obsolete before cleanup; an obsolete attempt must not mutate state; non-abortable library operations may settle but their late callbacks are dropped by `isCurrent(attempt)`; cleanup calls `stopStream()` and is idempotent (guarded by a `closed` flag); partial setup is cleaned up on failure; a stale attempt cannot interfere with a newer attempt; after cancellation/failure the screen is ready for a fresh Start; no session lingers after leaving the screen.

### Attempt shape

```text
RTMP publish attempt: { id, closed }
```

No `pc`, no `stream`, no `abort`. The `<RTMPPublisher>` component and its ref are owned by the hook; `stopStream()` is the imperative cleanup.

### Imperative cleanup

`cleanupAttempt` calls `publisherRef.current?.stopStream()` before the status -> `idle` unmount of `<RTMPPublisher>`. The `closed` flag plus `isCurrent(attempt)` guard drops any late connection callbacks that arrive after cleanup begins.

## Error Handling

- Invalid URLs are rejected on the URL-entry screen and do not navigate.
- `onConnectionFailed(data: string)` carries a string; the hook surfaces it as the error message. Other failures (no callback, unexpected state) fall back to a generic `'Connection failed'`.
- A failed start leaves the user on `RtmpPublisherScreen`, recoverable without restarting the app.
- Camera/microphone permission denial is surfaced via the library's failure callback (generic message); the permissions are already requested (NSCameraUsageDescription / NSMicrophoneUsageDescription exist for WHIP).

## Native Configuration

### Dependencies

- `react-native-rtmp-publisher` `0.4.7` (exact, no caret) added to `SRSRN/package.json`. Verified compatible with RN 0.86 at the build level (iOS simulator BUILD SUCCEEDED with the new-arch interop layer).
- iOS: `pod install` adds `HaishinKit` 1.2.7 (and transitives). 86 total pods.

### iOS

- **`AppDelegate.swift` AVAudioSession:** add an AVAudioSession PlayAndRecord setup (mode voiceChat, options defaultToSpeaker + allowBluetooth) in `application(_:didFinishLaunchingWithOptions:)` before `return true`, with `import AVFoundation`. This is the Swift translation of the library's documented Objective-C requirement. Without it, audio capture routing is incorrect.
- **Permissions:** `NSCameraUsageDescription` and `NSMicrophoneUsageDescription` already exist (added for WHIP). No new permission keys.
- **Local network:** `NSLocalNetworkUsageDescription` already exists (added for SRT). RTMP to `192.168.1.100` is covered.

### Android

- The library's Gradle config is applied by its plugin. Camera/microphone permissions already exist for WHIP. No new Android config expected (verify during implementation).

## URL Entry and Validation

- `DEFAULT_RTMP_PUBLISH_URL = 'rtmp://192.168.1.100:1935/live/livestream'` - the SRS RTMP publish endpoint (same URL form as RTMP play; SRS uses the same `rtmp://host:1935/app/stream` URL for ingest and play).
- `validateRtmpPublishUrl` mirrors `validateRtmpUrl` (play): trim, reject empty, parse as `URL`, require the `rtmp:` protocol. Does not enforce the app/stream path.
- `RtmpPublishUrlScreen` mirrors the other URL screens. Test IDs: `rtmp-publish-url-input`, `rtmp-publish-url-error`, `rtmp-publish-url-connect`.

## Testing

### Home Screen
- The RTMP Publish card renders and navigates to `RtmpPublishUrl`.
- An eighth launcher entry can still be rendered without layout changes (the synthetic extra entry's id must be non-colliding).

### URL Entry
- Displays `DEFAULT_RTMP_PUBLISH_URL`; keeps it editable; shows feedback for invalid input; does not navigate with invalid input; navigates with the exact valid URL.

### Validation
- Rejects empty/non-URL/non-`rtmp` schemes; accepts valid `rtmp://` URLs including the default.

### Publisher Screen and Session Hook
- No `<RTMPPublisher>` before Start; rapid repeated Start creates one attempt; Stop/unmount during connecting leaves no session and calls `stopStream()`; late connection callbacks from an obsolete attempt are dropped; cleanup is idempotent; a failed start (`onConnectionFailed`) leaves the screen ready for a fresh Start; a connection failure produces a user-visible recoverable message.

### App Navigation
- `RtmpPublishUrl` and `RtmpPublisher` mount through the unified navigator; Home remains the initial route.

## Verification

1. TypeScript, ESLint, Jest (including new RTMP publish suites).
2. iOS workspace build (the package already builds; confirm after the AppDelegate change).
3. Android Gradle configuration check.

**🔴 Gating device check:** the package is unmaintained and legacy-bridge. An actual RTMP publish to SRS (`rtmp://192.168.1.100:1935/live/livestream`) **must** be performed on a device to confirm the legacy module works at runtime under RN 0.86's new-arch interop and that HaishinKit 1.2.7 publishes to SRS. If publish does not work, this feature is non-functional and the project reconsiders (custom HaishinKit native module, or abandon RTMP publish in favor of WHIP). Do not claim RTMP publish was verified unless a stream was actually observed being published (and received) on SRS.

## Acceptance Criteria

- `features/rtmp_publish/` is a clean, independent feature directory.
- Other feature directories and the legacy apps remain unchanged.
- Home renders the RTMP Publish card with no `HomeScreen` layout change.
- The RTMP publish flow preserves an editable default URL, explicit Start, native capture+publish, error handling, and teardown, mirroring the WHIP lifecycle with imperative `stopStream()` cleanup.
- `AppDelegate.swift` includes the AVAudioSession PlayAndRecord setup.
- TypeScript, lint, Jest pass; iOS workspace builds; Android Gradle resolves.
- **RTMP publish is verified to actually push a stream to SRS on a device.** (Pending - this is the experimental gate.)
