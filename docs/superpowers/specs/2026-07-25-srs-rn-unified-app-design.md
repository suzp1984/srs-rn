# SRS RN Unified Application Design

**Date:** 2026-07-25
**Status:** Approved

## Objective

Create a new unified React Native application named **SRS RN** that hosts the existing WHIP publishing and WHEP playback features behind a protocol launcher. The application must be structured so additional live-media protocols can be added later without redesigning its navigation or mixing protocol-specific implementations.

The new application becomes the primary project for future development. The existing `WHIPPublisher/` and `WHEPPlayer/` projects remain unchanged as legacy/reference applications.

## Project Identity and Scope

The new independent application will use:

- Root directory: `SRSRN/`
- Native module/project name: `SRSRN`
- User-facing display name: `SRS RN`
- React Native baseline: the latest stable React Native `0.86.x` release compatible with the selected dependencies
- Primary verification target: iOS
- Preserved structural target: Android

### Included

- A fresh React Native 0.86 project rather than a renamed copy of an existing native project.
- A protocol-grid Home screen.
- Independent WHIP URL-entry and publishing flows.
- Independent WHEP URL-entry and playback flows.
- Feature-based source organization.
- Existing protocol-specific default URLs and editable URL behavior.
- Explicit media-session teardown on stop and navigation away.
- Automated tests, static checks, an iOS build, and Android configuration validation.

### Excluded

- Removing or modifying `WHIPPublisher/` or `WHEPPlayer/`.
- Keeping all three applications synchronized after this migration.
- Implementing protocols other than WHIP and WHEP.
- Building a generic media-session abstraction across unrelated protocols.
- Persisting edited endpoint URLs between application launches.
- Allowing media sessions to continue in the background after navigation.
- Requiring Android emulator or physical-device runtime verification.

## Architecture

Use a feature-based structure that keeps application-wide navigation separate from protocol implementations:

```text
SRSRN/
├── App.tsx
├── navigation/
│   ├── RootNavigator.tsx
│   └── types.ts
├── screens/
│   └── HomeScreen.tsx
├── launcher/
│   └── features.ts
└── features/
    ├── whip/
    │   ├── WhipUrlScreen.tsx
    │   ├── PublisherScreen.tsx
    │   ├── validation.ts
    │   └── types.ts
    └── whep/
        ├── WhepUrlScreen.tsx
        ├── PlayerScreen.tsx
        ├── validation.ts
        └── types.ts
```

Exact test-file placement may follow the generated project conventions, but tests must retain the same feature boundaries.

Each feature owns its screens, validation, route-facing types where useful, media lifecycle, and focused tests. A feature must be understandable and changeable without reading or modifying the other protocol implementation.

## Launcher

The initial route is `Home`. The Home screen displays the approved two-column protocol grid with these initial entries:

- **WHIP Publish** — opens the WHIP URL-entry screen.
- **WHEP Play** — opens the WHEP URL-entry screen.

Launcher cards are rendered from a small configuration containing:

- Stable feature ID
- Title and description
- Action label
- Color or icon presentation metadata
- Navigation destination

The launcher configuration is limited to presentation and routing. It does not define a common connection, transport, or media-session interface.

The grid should adapt naturally when future entries such as HLS or SRT are added. Adding a new launcher card must not require rewriting `HomeScreen` layout logic.

## Navigation

Use one typed native-stack navigator:

```text
Home
├── WhipUrl → Publisher
└── WhepUrl → Player
```

The media URL is passed from its URL-entry screen to its media screen as a typed route parameter. WHIP and WHEP routes and defaults remain independent.

Only one media screen can be mounted at a time. Returning from Publisher or Player unmounts the media screen and triggers complete session teardown before the user opens another feature.

## WHIP Publishing Flow

1. From Home, the user selects WHIP Publish.
2. `WhipUrlScreen` displays an editable field initialized with the current `WHIPPublisher` default URL.
3. The screen accepts only syntactically valid HTTP or HTTPS URLs.
4. A valid submission navigates to Publisher with the URL route parameter.
5. Publisher starts only when the user presses Start.
6. Publisher creates send-only audio and video transceivers.
7. It requests camera and microphone media and attaches the acquired tracks.
8. It creates a local SDP offer, applies it locally, and POSTs the SDP to the selected endpoint with `Content-Type: application/sdp`.
9. It reads the successful response body as plain-text answer SDP and applies it as the remote description.
10. It displays the local stream as a preview.
11. Stop, navigation away, unmount, or partial-start failure closes the peer connection and stops all acquired local tracks.

## WHEP Playback Flow

1. From Home, the user selects WHEP Play.
2. `WhepUrlScreen` displays an editable field initialized with the current `WHEPPlayer` default URL.
3. The screen accepts only syntactically valid HTTP or HTTPS URLs.
4. A valid submission navigates to Player with the URL route parameter.
5. Player starts only when the user presses Start.
6. Player creates receive-only audio and video transceivers.
7. It creates a local SDP offer, applies it locally, and POSTs the SDP to the selected endpoint with `Content-Type: application/sdp`.
8. It reads the successful response body as plain-text answer SDP and applies it as the remote description.
9. Remote tracks are collected into a media stream and rendered through `RTCView`.
10. Stop, navigation away, unmount, or partial-start failure closes the peer connection and releases remote stream tracks.

## Session Lifecycle

Each media screen owns its session state; there is no global peer connection or media stream.

The lifecycle rules are:

- Start is explicit and guarded against duplicate requests.
- A second concurrent session cannot be started from the same screen.
- Stop is safe to invoke more than once.
- Unmount cleanup is safe after either a successful or failed start.
- Partial setup is cleaned up if any later setup step fails.
- State is not updated after the owning screen has unmounted.
- No session remains active after leaving Publisher or Player.

## Error Handling

Both features follow the same policy without sharing protocol implementation code:

- Invalid URLs are rejected on the URL-entry screen and do not navigate.
- Non-successful HTTP responses are detected before answer SDP is applied.
- Network, permission, media-acquisition, SDP, and peer-connection failures produce concise user-visible messages.
- Development logs retain enough technical detail to diagnose the underlying error.
- Any resources acquired before a failure are released before retry.
- A failed start leaves the user on the media screen, where they can retry or navigate back.
- Permission denial and unreachable-server states must be recoverable without restarting the application.

## Native Configuration

Create `SRSRN` from a fresh React Native 0.86 template to avoid stale native identifiers and references from either legacy application.

### Dependencies

Install compatible versions of:

- React and React Native from the selected 0.86 template
- `react-native-webrtc`
- `@react-navigation/native`
- `@react-navigation/native-stack`
- `react-native-gesture-handler`
- `react-native-screens`
- `react-native-safe-area-context`

Dependency versions must be checked for compatibility rather than copied blindly from a different React Native release.

### iOS

- Set the display name to `SRS RN`.
- Include camera and microphone usage descriptions for WHIP publishing.
- Preserve access to the local HTTP SRS development endpoints used by the current defaults.
- Install CocoaPods dependencies and build the generated workspace.
- Treat iOS build and functional behavior as required verification targets.

### Android

- Retain valid React Native 0.86 template structure.
- Add camera, microphone, and network permissions needed by the unified feature set.
- Permit cleartext development endpoints where required by the preserved HTTP defaults.
- Validate Gradle project configuration, without claiming emulator or physical-device runtime verification.

## Testing

### Home Screen

- Renders WHIP and WHEP cards from launcher configuration.
- Each card navigates to the correct URL-entry screen.
- Another launcher entry can be rendered without changing Home screen layout logic.

### URL Entry

For each feature:

- Displays the protocol's current standalone default URL.
- Keeps the URL editable.
- Shows feedback for invalid input.
- Does not navigate with invalid input.
- Navigates with the exact valid URL as a typed parameter.
- Does not use or overwrite the other protocol's default.

### Media Screens

WHIP tests cover:

- Send-only audio and video transceivers.
- Camera and microphone acquisition.
- Local-track attachment and preview.
- SDP request and answer handling.
- Duplicate-start protection.
- Cleanup after failure, Stop, and unmount.

WHEP tests cover:

- Receive-only audio and video transceivers.
- Remote-track handling and rendering.
- SDP request and answer handling.
- Duplicate-start protection.
- Cleanup after failure, Stop, and unmount.

Both test suites cover visible HTTP, network, and SDP errors.

### App Navigation

- Home is the initial route.
- Home, WhipUrl, Publisher, WhepUrl, and Player mount through the unified navigator.

## Verification

Run all commands inside `SRSRN/`, because it is an independent application.

Required automated and build checks:

1. Install JavaScript dependencies.
2. Run TypeScript checking.
3. Run ESLint.
4. Run Jest.
5. Install CocoaPods dependencies.
6. Build the iOS workspace.
7. Launch on the available physical iOS device when the environment permits.
8. Run an Android Gradle configuration check.

Required iOS functional checks:

1. Launch into the protocol-grid Home page.
2. Open WHIP, retain or edit its URL, start publishing camera and microphone media, and stop cleanly.
3. Return Home and confirm publishing has ended.
4. Open WHEP, retain or edit its URL, receive remote media, and stop cleanly.
5. Confirm navigation away ends playback.
6. Confirm permission denial and unreachable-server errors are understandable and recoverable.

If a physical device or reachable SRS endpoint is unavailable, complete all possible automated and native build checks and explicitly report the remaining manual steps. Do not claim endpoint-dependent behavior was verified when it was not observed.

## Acceptance Criteria

The work is complete when:

- `SRSRN/` is a clean, independent React Native 0.86 application with native identity `SRSRN` and display name `SRS RN`.
- `WHIPPublisher/` and `WHEPPlayer/` remain unchanged.
- SRS RN launches into the protocol-grid Home screen.
- The WHIP flow preserves the current editable default URL and publishing behavior.
- The WHEP flow preserves the current editable default URL and playback behavior.
- Stop and navigation-away teardown prevent more than one active media session.
- User-visible failures are recoverable and partial resources are released.
- TypeScript, lint, and Jest checks pass.
- The iOS workspace builds successfully and functional checks are completed where device and endpoint access permit.
- Android remains structurally valid and passes the selected Gradle configuration check.
- A future protocol can be added as a separate feature directory and launcher entry without redesigning Home or forcing it into a WebRTC-specific abstraction.
